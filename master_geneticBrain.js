import { Position, Direction } from "./data/position.js";
import { Action, ActionType } from "./data/action.js";
import { Field } from "./data/field.js";
import { Rider } from "./master_rider.js";
import { sortByKey } from "./utils.js";

/**
 * @class Genetic
 *
 * Contains the genetic algorithm for the planning of the agents,
 * it generates a plan for each agent based on the current state of the
 * entire field and the agents. The plan will be an approximation of
 * of a variation of the Travelling Salesman Problem that takes into
 * account the rewards of the parcels and and the cost of reaching them.
 *
 * @property {Array} riders - The list of all the controlled agents
 * @property {number} nriders - The number of controlled agents
 * @property {Object} config - The configuration object received from the server
 * @property {Field} field - The field object containing the map
 * @property {Map} parcels - The map of all the parcels on the field
 * @property {number} pop - The size of the population for the genetic algorithm
 * @property {number} gen - The number of generations for the genetic algorithm
 * @property {number} plan_fit - The fitness of the current plan
 * @property {Boolean} planLock - A flag to prevent multiple plans from being generated
 * @property {number} tot_time - The total time spent generating plans [metrics]
 * @property {number} tot_plans - The total number of plans generated [metrics]
 */
export class Genetic {
  constructor(riders, field, parcels, pop, gen) {
    //riders
    this.riders = riders;
    this.nriders = riders.length;

    //brain settings
    this.field = field;
    this.parcels = parcels;
    this.plan_fit = 0;
    this.planLock = false;
    this.config = {};

    //Genetic params
    this.pop = pop;
    this.gen = gen;

    //metrics
    this.tot_time = 0;
    this.tot_plans = 0;
    this.plan_time_avg = 0;

    console.log("Genetic brain created with ", this.nriders, " riders");
  }

  /**
   *
   * @param {Object} config - The configuration object received from the server
   */
  setConfig(config) {
    this.config = config;
    console.log("Config received: ", this.config);

    let parcel_decay = parseFloat(this.config.PARCEL_DECADING_INTERVAL);
    if (isNaN(parcel_decay)) {
      if (this.config.PARCEL_DECADING_INTERVAL === "infinite") {
        this.config.PARCEL_DECADING_INTERVAL = 10;
      } else {
        this.config.PARCEL_DECADING_INTERVAL = 0;
      }
    } else {
      this.config.PARCEL_DECADING_INTERVAL = parcel_decay;
    }
  }

  /**
   * Translates the parcels on the field into a graph representation
   * that can be used to generate a plan for the agents.
   *
   * @param {Rider} rider - The rider for which the graph is being generated
   *
   * @returns {[Array, Array, Array]} - The costs, paths and prep_parcels of the graph,
   * costs and paths are both 2-dimensional arrays corresponding to the costs
   * and paths between each pair of nodes, prep_parcels corresponds the the nodes of the graph,
   * each element contains the coordinates and reward of the parcel and  costs and paths both to get
   * there form the player position and to get to the closest delivery zone.
   */
  async buildGraphInOut(rider) {
    console.log("Building graph for rider:", rider.id);
    let prep_parcels = [];

    // Prepare each parcel for the graph
    for (const [key, p] of this.parcels.entries()) {
      // console.log(`Processing parcel ${key} at (${p.x}, ${p.y})`);

      // console.log("Parcel:", p);
      // Compute the cost and path from the player to the parcel
      // let start = this.field.getTile({ x: p.x, y: p.y });
      let start = new Position(p.x, p.y);
      // console.log(`Start tile: ${start.position.x}, ${start.position.y}`);
      let end = rider.trg;
      // console.log(`End tile: ${end.position.x}, ${end.position.y}`);

      // if (!start || !end) {
      //   console.log(`⚠️ Invalid start or end tile for parcel ${key}:`, {
      //     start,
      //     end,
      //   });
      //   continue;
      // }

      let bfs_result = await this.field.bfsWrapper(
        [{ start, end, i: 0, j: 0 }],
        rider.blocking_agents
      );
      let cost_from_player, path_from_player;
      if (bfs_result.length === 0 || bfs_result[0].path === -1) {
        cost_from_player = Infinity;
        path_from_player = [];
      } else {
        path_from_player = bfs_result[0].path;
        cost_from_player = path_from_player.length - 1;
      }

      // Compute the cost and path from the parcel to the closest delivery zone
      start = { x: p.x, y: p.y };
      let closest = await this.field.getClosestDeliveryZones(
        start,
        rider.blocking_agents
      );

      let path_to_zone, cost_to_zone;
      if (closest.length === 0) {
        cost_to_zone = Infinity;
        path_to_zone = [];
      } else {
        path_to_zone = closest[0].path;
        cost_to_zone = closest[0].distance - 1;
      }

      prep_parcels.push({
        x: p.x,
        y: p.y,
        rew: p.reward,
        in_c: cost_from_player,
        out_c: cost_to_zone,
        id: key,
        path_in: path_from_player,
        path_out: path_to_zone,
      });
    }

    console.log(`Prepared ${prep_parcels.length} parcels`);

    // Initialize costs and paths matrices
    let costs = Array(prep_parcels.length)
      .fill()
      .map(() => Array(prep_parcels.length).fill(Infinity));
    let paths = Array(prep_parcels.length)
      .fill()
      .map(() => Array(prep_parcels.length).fill([]));

    for (let i = 0; i < prep_parcels.length; i++) {
      costs[i][i] = Infinity;
      paths[i][i] = [];
    }

    //TODO: BFS returns steps in reverse order so stTile and endTile are swapped here. Gotta fix this

    // Create a list of all start-end couples
    let bfsCouples = [];
    for (let i = 0; i < prep_parcels.length; i++) {
      for (let j = 0; j < prep_parcels.length; j++) {
        let stTile = this.field.getTile({
          x: prep_parcels[i].x,
          y: prep_parcels[i].y,
        });
        let endTile = this.field.getTile({
          x: prep_parcels[j].x,
          y: prep_parcels[j].y,
        });
        bfsCouples.push({
          start: endTile.position,
          end: stTile.position,
          i,
          j,
        });
      }
    }

    // // Handle the case when there's only one parcel
    // if (prep_parcels.length === 1) {
    //   console.log("Only one parcel found. Creating self-couple.");
    //   const parcel = prep_parcels[0];
    //   const tile = this.field.getTile({ x: parcel.x, y: parcel.y });
    //   if (tile) {
    //     bfsCouples = [
    //       {
    //         start: tile.position,
    //         end: tile.position,
    //         i: 0,
    //         j: 0,
    //       },
    //     ];
    //     costs = [[0]];
    //     paths = [[[]]];
    //   } else {
    //     console.error("Invalid tile for single parcel:", parcel);
    //   }
    // }

    console.log(`Created ${bfsCouples.length} couples for BFS`);

    // Call the modified bfsWrapper function
    let bfsResults = await this.field.bfsWrapper(
      bfsCouples,
      rider.blocking_agents
    );

    console.log(`Received ${bfsResults.length} results from bfsWrapper`);

    // Process the results
    for (let result of bfsResults) {
      let { i, j, path } = result;
      if (path === -1 || path.length === 0) {
        costs[i][j] = Infinity;
        paths[i][j] = [];
      } else {
        paths[i][j] = path;
        costs[i][j] = path.length;
      }
    }

    // console.log("Finished building graph");

    // this.printMat(costs);
    // console.log("pp: ", prep_parcels);
    // console.log("paths: ", paths);
    // console.log("path_in: ", prep_parcels[0].path_in);
    //ddddd = 88;
    return [costs, paths, prep_parcels];
  }

  // ----------------- OLD -----------------

  // // build graph matrices
  // for (let i = 0; i < prep_parcels.length; i++) {
  //     costs[i] = [];
  //     paths[i] = [];

  //     for (let j = 0; j < prep_parcels.length; j++) {
  //         if (i == j) {
  //             costs[i][j] = Infinity;
  //             paths[i][j] = [];
  //         } else {
  //             let stTile = this.field.getTile({
  //                 x: prep_parcels[i].x,
  //                 y: prep_parcels[i].y,
  //             });

  //             let endTile = this.field.getTile({
  //                 x: prep_parcels[j].x,
  //                 y: prep_parcels[j].y,
  //             });

  //             let path = await this.field.bfsWrapper(stTile, endTile, rider.blocking_agents);
  //             if (path == -1 || path.length == 0) {
  //                 costs[i][j] = Infinity;
  //                 paths[i][j] = [];
  //             } else {
  //                 paths[i][j] = path;
  //                 costs[i][j] = path.length;
  //             }
  //         }
  //     }
  // }

  // return [costs, paths, prep_parcels];

  /**
   * Removes a random number of elements from a list
   *
   * @param {Array} list - The list to be masked
   * @returns {Array} - The masked list
   */
  maskList(list) {
    let num_del = list.length - (Math.floor(Math.random() * list.length) + 1);

    for (let i = 0; i < num_del; i++) {
      let idx = Math.floor(Math.random() * list.length);
      list.splice(idx, 1);
    }
    return list;
  }

  /**
   * Generates the scores and chances for the roulette wheel selection
   * of the genetic algorithm
   *
   * @param {Array} population - The population of the genetic algorithm
   * @param {Array} riders_graphs - The paths of the riders
   *
   * @returns {[Array, Array]} - The scores and chances (to be picked) of the population
   */
  rouletteWheel(population, riders_graphs) {
    let scores = [];
    let tot_fit = 0;
    let min_fit = 0;
    for (const family of population) {
      let [fit, _] = this.fitness(family, riders_graphs);
      if (fit < 0) {
        fit = 0;
      }
      scores.push(fit);
      if (fit < min_fit) {
        min_fit = fit;
      }
    }

    for (const score of scores) {
      tot_fit += score - min_fit;
    }

    let chances = [];
    for (const score of scores) {
      let chance = ((score - min_fit) / (tot_fit + 1)) * scores.length;
      chances.push(chance);
    }

    return [scores, chances];
  }

  /**
   * Returns the elite individuals, the
   * best 'elite_rate %' of the population
   *
   * @param {Array} population - The population of the genetic algorithm
   * @param {Array} scores - The scores of the population
   * @param {number} elite_rate - The percentage of the population to be considered elite
   *
   * @returns {Array} - The elite individuals
   */
  getElites(population, scores, elite_rate) {
    let mapped = scores.map((el, idx) => {
      return { index: idx, score: el };
    });

    mapped = sortByKey(mapped, "score");

    let elites = [];
    let num_elites = Math.round(mapped.length * elite_rate);
    for (let i = 0; i < num_elites; i++) {
      elites.push(mapped[mapped.length - i - 1].index);
    }

    let elite_dna = [];
    for (const idx of elites) {
      elite_dna.push(population[idx]);
    }
    return elite_dna;
  }

  /**
   * Picks an individual from the population based on the chances
   * computed by the roulette wheel selection
   *
   * @param {Array} population - The population of the genetic algorithm
   * @param {Array} chances - The chances of each individual to be picked
   *
   * @returns {Array} - The picked individual
   */
  pickOne(population, chances) {
    let val = Math.random();
    let cum = 0;
    let norm = [];

    for (const chance of chances) {
      cum += chance;
    }
    for (const chance of chances) {
      norm.push(chance / cum);
    }
    let idx = 0;
    while (val > 0) {
      val -= norm[idx];
      idx++;
    }
    idx--;

    return population[idx];
  }
  /**
   * Performs a multi-crossover between two parents, each parent
   * is composed of a list of DNAs (one for each rider) where the DNA
   * corresponds to the sequence of parcels to be picked up.
   * Each DNA will be crossed with the corresponding DNA of the other parent
   * and duplicate parcels will be removed starting from the longest sequence.
   *
   * @param {Array} parentA - The first parent
   * @param {Array} parentB - The second parent
   *
   * @returns {Array} - The crossed children
   */
  multiCrossover(parentA, parentB) {
    let childs = [];

    // perform crossover for each rider.
    // Each DNA is split in half and child is composed of the head of
    // one parent and the tail of the other parent. Elements are added
    // one by one making sure that no duplicates are present.
    for (let r = 0; r < this.nriders; r++) {
      let dnaA = parentA[r];
      let dnaB = parentB[r];

      let seg_len = Math.floor(dnaA.length / 2);

      let start = Math.floor((dnaA.length - seg_len) / 2);
      let end = start + seg_len;

      let a_segment = dnaA.slice(start, end);
      let head = [];
      let tail = [];

      for (const el of dnaB) {
        if (!a_segment.includes(el)) {
          if (head.length <= dnaA.length - seg_len) {
            head.push(el);
          } else if (head.length + tail.length < dnaA.length - seg_len) {
            tail.push(el);
          } else {
            break;
          }
        }
      }
      let child = [].concat(head).concat(a_segment).concat(tail);
      childs.push(child);
    }

    // creates a list of tuples containing the length of each DNA
    let subl_len = [];
    for (let i = 0; i < childs.length; i++) {
      subl_len.push({ len: childs[i].length, idx: i });
    }
    subl_len = sortByKey(subl_len, "len");

    // removes duplicate parcels from the childs starting from the longest
    let clean_childs = [];
    let dupl = new Set();
    for (const sub of subl_len) {
      let clean_child = [];
      let idx = sub.idx;
      for (const el of childs[idx]) {
        if (dupl.has(el)) {
        } else {
          clean_child.push(el);
          dupl.add(el);
        }
      }
      clean_childs.push(clean_child);
    }

    // orders the childs based on the original order
    let ordered_childs = [];
    for (let i = 0; i < clean_childs.length; i++) {
      ordered_childs[subl_len[i].idx] = clean_childs[i];
    }

    return ordered_childs;
  }

  /**
   * Computes the cost of a step (going from one node to the next)
   * based on the cost of reaching the node and the current
   * carrying capacity of the agent. The penalty is dinamically
   * computed based on the number of parcels the agent is carrying and
   * the decay of the parcels.
   *
   * @param {number} cost_in - The cost of reaching the parcel
   * @param {number} curr_carr - The current carrying capacity of the agent
   *
   * @returns {number} - The cost of the step
   */
  getStepCost(cost_in, curr_carr) {
    let decay_bonus = (this.config.PARCEL_DECADING_INTERVAL - 1) / 9;

    let STEP_COST = 0.5 - decay_bonus * 0.2;

    let cost = cost_in * STEP_COST * (curr_carr + 1);
    return cost;
  }

  /**
   * Computes the fitness of a family (a list of DNAs, one for each rider)
   * based on the paths of the riders and the delivery-only fits.
   *
   * The fitness is computed for plans containing parcels so delivery-only
   * plans are computed separately once and considered only if they are better
   * than all the other plans.
   *
   * @param {Array} family - The family of DNAs
   * @param {Array} riders_graphs - The graphs for each rider
   * @param {Array} delivery_only_fits - The delivery-only fits
   *
   * @returns {[Number, Array]} - The cumulative reward of the family and a list
   * of booleans indicating if that rider should deliver only
   */
  fitness(family, riders_graphs, delivery_only_fits = null) {
    let cumulative_rew = 0;
    let delivery_only = [];

    for (let r = 0; r < this.nriders; r++) {
      let delivery_only_fit = -Infinity;
      if (delivery_only_fits != null) {
        delivery_only_fit = delivery_only_fits[r];
      }

      let costs = riders_graphs[r].costs;
      let nodes = riders_graphs[r].nodes;
      let dna = family[r];
      let rew = 0;

      if (dna.length > 0) {
        let curr_carr = this.riders[r].player_parcels.size;

        // reward for the amount of points the rider is already carrying
        rew = this.riders[r].carrying;

        // reward of first parcel minus cost of reaching it
        rew +=
          nodes[dna[0]].rew - this.getStepCost(nodes[dna[0]].in_c, curr_carr);

        curr_carr += 1;

        // reward of each parcel in DNA minus cost of reaching it
        for (let i = 1; i < dna.length; i++) {
          rew +=
            nodes[dna[i]].rew -
            this.getStepCost(costs[dna[i - 1]][dna[i]], curr_carr);

          curr_carr += 1;
        }

        // cost of reaching the delivery zone fron the last parcel
        rew += -this.getStepCost(nodes[dna[dna.length - 1]].out_c, curr_carr); //* STEP_COST * curr_carr;
      } else {
        rew = 0;
      }

      // check if it's better to deliver only
      if (rew < delivery_only_fit && delivery_only_fit > 0) {
        cumulative_rew += delivery_only_fit;
        delivery_only.push(true);
      } else {
        cumulative_rew += rew;
        delivery_only.push(false);
      }
    }
    return [cumulative_rew, delivery_only];
  }

  /**
   * Generates a plan for the agents based on the genetic algorithm.
   * The script will create a starting random population of size 'pop_size'
   * and iterate for 'gen_num' generations. Each new generation will be
   * composed of the 'elite_rate'% of the best individuals of the previous
   * generation and the rest will be generated by crossover and mutation.
   *
   * @param {Array} riders_graphs - The graphs for each rider
   * @param {Array} delivery_only_fits - The delivery-only fits
   * @param {number} pop_size - The size of the population
   * @param {number} gen_num - The number of generations
   * @param {number} mutation_rate - The mutation rate
   * @param {number} elite_rate - The elite rate
   *
   * @returns {[Array, Number]} - The generated plan and its fitness
   */
  geneticTSP(
    riders_graphs,
    delivery_only_fits,
    pop_size = 1000,
    gen_num = 100,
    mutation_rate = 0.1,
    elite_rate = 0.5
  ) {
    let genes = [];

    // prepare the genes for the genetic algorithm
    for (let rid = 0; rid < this.nriders; rid++) {
      const r = riders_graphs[rid];

      genes = Array.from(Array(r.nodes.length).keys());

      if (genes.length == 0) {
        let empty_plan = Array.from({ length: this.riders.length }, () => []);
        console.log("No parcels in sight, returning empty plan ", empty_plan);
        return [empty_plan, 0];
      }
    }

    let best_d_o = [];
    let best_dna = [];
    let best_fit = 0;
    let population = [];

    // generate the initial population
    for (let i = 0; i < pop_size; i++) {
      let order = genes.slice();
      order = order.sort(() => Math.random() - 0.5);
      let masked = this.maskList(order);

      let slices = [];
      for (let j = 0; j < this.nriders - 1; j++) {
        slices.push(Math.round(Math.random() * (masked.length - 1)));
      }
      slices = slices.sort((a, b) => a - b);

      let family = [];

      family.push(masked.slice(0, slices[0]));
      for (let j = 1; j < slices.length; j++) {
        family.push(masked.slice(slices[j - 1], slices[j]));
      }
      if (slices.length > 0) {
        family.push(masked.slice(slices[slices.length - 1], masked.length));
      }

      population.push(family);
    }

    // iterate over the generations
    for (let i = 0; i < gen_num; i++) {
      let new_pop = [];

      //compute chance of each individual to be picked
      const [scores, chances] = this.rouletteWheel(population, riders_graphs);

      // get the elite (best) individuals
      let elites = this.getElites(population, scores, elite_rate);
      new_pop = new_pop.concat(elites);

      // generate the new population
      for (let j = 0; j < pop_size - elites.length; j += 2) {
        let parentA = this.pickOne(population, chances);
        let parentB = this.pickOne(population, chances);

        let childA = this.multiCrossover(parentA, parentB);
        let childB = this.multiCrossover(parentB, parentA);

        new_pop.push(childA);
        new_pop.push(childB);
      }

      // mutate the population
      for (let j = 0; j < new_pop.length; j++) {
        if (Math.random() < mutation_rate) {
          let idxFamA = Math.floor(Math.random() * new_pop[j].length);
          let idxFamB = Math.floor(Math.random() * new_pop[j].length);

          let idxA = Math.floor(Math.random() * new_pop[j][idxFamA].length);
          let idxB = Math.floor(Math.random() * new_pop[j][idxFamB].length);

          // adding padding to avoid indexing empty arrays
          for (let k = 0; k < new_pop[j].length; k++) {
            new_pop[j][k].push(-1);
          }

          let tmp = new_pop[j][idxFamA][idxA];
          new_pop[j][idxFamA][idxA] = new_pop[j][idxFamB][idxB];
          new_pop[j][idxFamB][idxB] = tmp;

          // removing padding
          for (let k = 0; k < new_pop[j].length; k++) {
            new_pop[j][k] = new_pop[j][k].filter((a) => a != -1);
          }
        }
      }

      population = new_pop;

      let tot_fit = 0;

      // saving the best family of the generation
      for (const family of population) {
        let [fit, d_o] = this.fitness(
          family,
          riders_graphs,
          delivery_only_fits
        );
        tot_fit += fit;

        if (fit > best_fit) {
          best_d_o = d_o;
          best_fit = fit;
          best_dna = JSON.parse(JSON.stringify(family));
        }
      }
      // console.log("Best DNA: ", best_dna);
      // if (i % 5 == 0) {
      //   console.log("Gen " + i + " avg fitness: ", tot_fit / pop_size);
      //   //console.log(population.length, " ", pop_size);
      // }
    }

    // if the best fit is 0, return an empty plan
    if (best_fit == 0) {
      let empty_plan = Array.from({ length: this.nriders }, () => []);
      console.log("Best fit is zero, returning empty plan ", empty_plan);
      best_dna = empty_plan;
    }

    // if for any driver it's better to deliver only, set its plan to deliver only
    for (let r = 0; r < this.nriders; r++) {
      if (best_d_o[r]) {
        let d_o_f = delivery_only_fits[r];
        this.riders[r].log("Seems like it's better to deliver only: ", d_o_f);
        console.log(best_d_o);
        best_dna[r] = "D";
      }
    }
    return [best_dna, best_fit];
  }

  /**
   * The function will check if the rider is carrying parcels, if so
   * it will try to generate a plan to deliver them. If no delivery zones
   * are reachable or the rider is not carrying any parcels, the function
   * will generate a plan to move to a random spawnable tile.
   * If these options are not available, the function will return a
   * reflexive move.
   *
   * @param {Rider} rider
   * @returns {Array} - The sequence of actions for the backup plan
   */
  async backupPlan(rider) {
    let rew = 1;

    let path_to_closest = -1;
    let path_to_spawnable = -1;

    // if rider is carrying parcels, generate a plan to deliver them
    // otherwise generate a plan to move to a random spawnable tile
    if (rider.carrying > 0) {
      rew += rider.carrying;
      console.log("Agent is packing, going to closest delivery zone");

      let closest = await this.field.getClosestDeliveryZones(
        rider.trg,
        rider.blocking_agents
      );

      if (closest.length == 0) {
        rider.log("No delivery zones reachable");
      } else {
        path_to_closest = closest[0].path;
      }
    } else {
      rider.log("No parcels on rider, generating random plan");
      let spawnable = await this.field.getRandomSpawnable(
        new Position(rider.trg.x, rider.trg.y),
        rider.blocking_agents
      );

      if (spawnable == -1) {
        rider.log("No spawnable tiles reachable");
      } else {
        console.log("Spawnable tile found at: ", spawnable[0]);
        path_to_spawnable = spawnable[0].path;
      }
    }

    let actions = [];

    if (path_to_closest != -1) {
      console.log("[BACKUP] A reachable delivery zone was found!");
      actions = Action.pathToAction(path_to_closest, ActionType.PUTDOWN, null);
    } else if (path_to_spawnable != -1) {
      console.log("[BACKUP] A reachable spawnable tile was found!");

      console.log("path to spawnable: ", path_to_spawnable);

      actions = Action.pathToAction(path_to_spawnable, ActionType.MOVE, null);
      rew = 0;
    } else {
      console.log("[BACKUP] No reachable valid plans found!");
      console.log("[BACKUP] Returning random reflexive move");
      rew = 0;
      let blocking = [];
      for (const a of rider.blocking_agents.values()) {
        blocking.push(a.x + "-" + a.y);
      }

      let movement = null;
      let target_position = null;
      for (const dir in Direction) {
        target_position = new Position(rider.trg.x, rider.trg.y).moveTo(
          Direction[dir]
        );
        console.log(
          "⚠️ trying to move ",
          Direction[dir],
          " to ",
          target_position
        );
        let target_tile = this.field.getTile(target_position);

        if (
          target_tile != -1 &&
          !this.field.isTileUnreachable(target_tile, blocking)
        ) {
          movement = Direction[dir];
          console.log("found walkable tile");
          break;
        } else {
          console.log("Tile is unreachable");
        }
      }

      let starting_action = new Action(
        rider.src,
        rider.trg,
        ActionType.MOVE,
        null
      );
      actions = [
        starting_action,
        new Action(
          new Position(rider.trg.x, rider.trg.y),
          target_position,
          ActionType.MOVE,
          null
        ),
      ];
    }

    console.log("[BRAIN] Generated BACKUP plan with rew ", rew);
    return [actions, rew];
  }

  /**
   * Generates a plan for the agents based on the genetic algorithm.
   * The genetic algorithm will return a sequence of parcels to pick up
   * for each rider. This function will call a backup plan in case the
   * genetic algorithm fails to generate a good (fit > 0) and will
   * check if it's better to deliver only.
   * Based on the generated plan, the function will generate a sequence
   * of actions for each rider.
   *
   * @returns {Array} - The sequence of actions for each rider
   */
  async createPlan() {
    let riders_graphs = [];

    // build the parcels graph for each rider with the costs and paths to move
    // from one parcel to another as well as the information (cost to reach, cost to deliver
    // and reward) of each parcel
    console.log("starting positions: ");
    for (const r of this.riders) {
      r.log("Rider at: " + r.trg.x + " " + r.trg.y);
      const [costs, paths, parc] = await this.buildGraphInOut(r);
      riders_graphs.push({
        costs: costs,
        paths: paths,
        nodes: parc,
      });
    }

    // compute the delivery-only fits for each rider and generate the delivery plans
    // that will be used in case the fitness of the generated plan is lower
    // than the delivery-only plan
    let delivery_only_fits = [];
    let delivery_only_plans = [];
    for (let rid = 0; rid < this.nriders; rid++) {
      let agent = this.riders[rid];
      let closest = await this.field.getClosestDeliveryZones(
        agent.trg,
        agent.blocking_agents
      );

      if (closest.length == 0) {
        delivery_only_fits.push(-Infinity);
        delivery_only_plans.push(-1);
      } else {
        let delivery_only_fit =
          agent.carrying -
          this.getStepCost(closest[0].distance, agent.player_parcels.size);

        if (delivery_only_fit <= 0) {
          delivery_only_fits.push(-Infinity);
          delivery_only_plans.push(-1);
        } else {
          delivery_only_fits.push(delivery_only_fit);
          delivery_only_plans.push(
            Action.pathToAction(closest[0].path, ActionType.PUTDOWN, null)
          );
        }
      }
    }
    console.log("delivery_only_fits: ", delivery_only_fits);

    // generate the plan using the genetic algorithm
    const [best_path, best_fit] = this.geneticTSP(
      riders_graphs,
      delivery_only_fits,
      this.pop,
      this.gen,
      0.3,
      0.5,
      0.2
    );

    //TODO:
    let parcels_path = Array.from({ length: this.nriders }, () => []);
    let all_plans = [];

    // generate the sequence of actions for each rider based on the generated plan
    for (let r = 0; r < this.nriders; r++) {
      let plan = [];

      if (best_path[r] == "D") {
        // if plan is to deliver only, assign it
        plan = delivery_only_plans[r];
      } else {
        // if no valid plan was found or fitness is 0 generate a backup plan
        if (best_path[r].length == 0 || best_fit == 0) {
          plan = await this.backupPlan(this.riders[r]);

          console.log("[BRAIN] Backup plan generated");
          all_plans.push(plan[0]);
          continue;
        }

        // prepare the list of parcels to be picked up
        for (const idx of best_path[r]) {
          let par = riders_graphs[r].nodes[idx];

          parcels_path[r].push({
            pos: new Position(par.x, par.y),
            parcel: par.id,
            path_in: par.path_in,
            path_out: par.path_out,
            inc: par.in_c,
          });
        }

        let chosen_path = parcels_path[r];

        // insert current rider action as first action in case
        // the rider is not at the starting position yet
        let starting_action = new Action(
          this.riders[r].src,
          this.riders[r].trg,
          ActionType.MOVE,
          null
        );

        plan.push(starting_action);

        // insert actions for reaching the first parcel
        let actions = Action.pathToAction(
          chosen_path[0].path_in,
          ActionType.PICKUP,
          chosen_path[0].parcel
        );
        plan = plan.concat(actions);

        // insert actions for reaching the rest of the parcels
        for (let i = 0; i < best_path[r].length; i++) {
          let curridx = best_path[r][i];
          if (i + 1 < best_path[r].length) {
            let nextidx = best_path[r][i + 1];
            let semi_path = riders_graphs[r].paths[curridx][nextidx];

            actions = Action.pathToAction(
              semi_path,
              ActionType.PICKUP,
              chosen_path[i + 1].parcel
            );

            plan = plan.concat(actions);
          }
        }

        // insert actions for reaching the delivery zone and delivering the parcels
        actions = Action.pathToAction(
          chosen_path[chosen_path.length - 1].path_out,
          ActionType.PUTDOWN,
          null
        );
        plan = plan.concat(actions);
      }

      all_plans.push(plan);
    }

    // print the generated plans
    for (let r = 0; r < this.nriders; r++) {
      console.log("Plan for Rider ", this.riders[r].name);
      for (const act of all_plans[r]) {
        act.printAction();
      }
    }
    return [all_plans, best_fit];
  }

  /**
   * This is the function agents will call to generate a new plan.
   * A plan will be created and if it satisfies the fitness condition
   * it will be accepted, otherwise it will be rejected.
   */
  async newPlan() {
    if (this.planLock) {
      console.log("Brain is already planning...");
      return;
    }
    this.planLock = true;

    try {
      let exp_decay = 0.9;
      let start = new Date().getTime();
      const [tmp_plan, best_fit] = await this.createPlan();
      this.tot_time += new Date().getTime() - start;
      this.tot_plans += 1;
      this.plan_time_avg =
        exp_decay * this.plan_time_avg +
        (1 - exp_decay) * (this.tot_time / this.tot_plans);

      console.log("AVG plan generation ", this.tot_time / this.tot_plans, "ms");
      console.log("proposed fit ", best_fit, " current fit ", this.plan_fit);

      const MINIMUM_GAIN = 1.2;
      if (best_fit > this.plan_fit * MINIMUM_GAIN || this.plan_fit == 0) {
        if (tmp_plan && tmp_plan.every((plan) => Array.isArray(plan))) {
          this.plan_fit = best_fit;

          for (let i = 0; i < this.nriders; i++) {
            this.riders[i].plan = tmp_plan[i];
          }

          console.log("New plan accepted ✅");
        } else {
          console.log("Invalid plan generated, keeping current plan");
        }
      } else {
        console.log("New plan rejected ❌");
      }
    } catch (error) {
      console.error("Error in newPlan:", error);
    } finally {
      this.planLock = false;
    }
  }
  /**
   *  This is a utility function used to print the matrix of costs
   *  representing the graph of the parcels used by the genetic algorithm.
   *
   * @param {Array.Array} mat
   */
  printMat(mat) {
    let str = "\\ \t";
    for (let i = 0; i < mat.length; i++) {
      str += i + "\t";
    }
    str += "\n";
    for (const row of mat) {
      str += mat.indexOf(row) + "\t";
      for (const cell of row) {
        let val = cell;
        if (cell > 9000) {
          val = "∞";
        }
        str += val + "\t";
      }
      str += "\n";
    }
    console.log(str);
  }
}
