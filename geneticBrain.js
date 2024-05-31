import { Position, Direction } from "./data/position.js";
import { Action, ActionType } from "./data/action.js";

export class Genetic {
  constructor() {
    this.config = {};
  }
  init(field, parcels, playerPosition, pop, gen) {
    this.field = field;
    this.parcels = parcels;
    this.x = playerPosition.x;
    this.y = playerPosition.y;
    this.pop = pop;
    this.gen = gen;
    this.timeout = 50;

    this.avgs = {};
    this.avg_fit = 0;
    this.iters = 0;

    // this.plan = this.createPlan(parcelsQueue)
  }
  set_config(config) {
    this.config = config;
    console.log("Config received: ", this.config);
    this.movement_duration = config.MOVEMENT_DURATION;

    this.parcel_decay = parseFloat(this.config.PARCEL_DECADING_INTERVAL);
    if (isNaN(this.parcel_decay)) {
      if (this.config.PARCEL_DECADING_INTERVAL === "infinite") {
        this.parcel_decay = Infinity;
      } else {
        this.parcel_decay = 0;
      }
    }
    console.log("Parcel decay: ", this.parcel_decay);
  }
  updateField(field) {
    this.field = field;
  }

  updatePlayerPosition(pos, timeout) {
    this.x = pos.x;
    this.y = pos.y;
    this.timeout = timeout;
  }

  sort_by_key(array, key) {
    return array.sort(function (a, b) {
      var x = a[key];
      var y = b[key];
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }

  builGraphInOut() {
    const MUL = 2;

    let prep_parcels = [];
    let dummy_parcel = {
      x: this.x,
      y: this.y,
      reward: 0,
    };

    let copy_parcels = new Map(this.parcels);
    copy_parcels.set("rider", dummy_parcel);

    for (const [key, p] of copy_parcels.entries()) {
      let path_fromPlayer = this.field.bfs(
        this.field.getTile({ x: p.x, y: p.y }),
        this.field.getTile({ x: this.x, y: this.y })
      );
      let fromPlayer;
      if (path_fromPlayer == -1) {
        console.log("No path from player to parcel ", key);
        fromPlayer = Infinity;
      } else {
        fromPlayer = path_fromPlayer.length - 1;
      }

      let closest = this.field.getClosestDeliveryZones({
        x: p.x,
        y: p.y,
      });

      let path_toZone;
      let toZone;
      if (closest.length == 0) {
        console.log("No delivery zones reachable");
        toZone = Infinity;
      } else {
        path_toZone = closest[0].path;
        toZone = closest[0].distance - 1;
      }

      let inc = fromPlayer;
      let outc = toZone;

      prep_parcels.push({
        x: p.x,
        y: p.y,
        rew: p.reward,
        in_c: inc,
        out_c: outc,
        id: key,
        path_in: path_fromPlayer,
        path_out: path_toZone,
      });
    }
    let costs = [];
    let paths = [];
    for (let i = 0; i < prep_parcels.length; i++) {
      costs[i] = [];
      paths[i] = [];

      for (let j = 0; j < prep_parcels.length; j++) {
        if (i == j) {
          costs[i][j] = Infinity;
        } else {
          let stTile = this.field.getTile({
            x: prep_parcels[i].x,
            y: prep_parcels[i].y,
          });

          let endTile = this.field.getTile({
            x: prep_parcels[j].x,
            y: prep_parcels[j].y,
          });

          let path = this.field.bfs(endTile, stTile);
          if (path.length == 0) {
            costs[i][j] = Infinity;
            // console.log("No path from ", i, " to ", j, " nodes unreaachabl");
          } else {
            // console.log("Path from ", i, " to ", j, " : ", path);
            paths[i][j] = path;
            costs[i][j] = path.length;
          }
        }
      }
    }

    //this.printMat(costs);
    return [costs, paths, prep_parcels];
  }

  maskList(list, p) {
    let num_del = list.length - (Math.floor(Math.random() * list.length) + 1);

    for (let i = 0; i < num_del; i++) {
      let idx = Math.floor(Math.random() * list.length);
      list.splice(idx, 1);
    }

    return list;
  }

  getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }

  rouletteWheel(population, costs, nodes, player_parcels) {
    let scores = [];
    let tot_fit = 0;
    for (const dna of population) {
      let fit = this.fitness(dna, costs, nodes, player_parcels);
      scores.push(fit);
      tot_fit += fit;
    }

    let chances = [];
    for (const score of scores) {
      let chance = Math.round((score / tot_fit) * scores.length);
      chances.push(chance);
    }

    return [scores, chances];
  }

  getElites(population, scores, elite_rate) {
    let mapped = scores.map((el, idx) => {
      return { index: idx, score: el };
    });

    mapped = this.sort_by_key(mapped, "score");

    let elites = [];
    let num_elites = Math.round(mapped.length * elite_rate);
    for (let i = 0; i < num_elites; i++) {
      elites.push(mapped[mapped.length - i - 1].index);
    }
    // console.log("Scores: ", scores);
    // console.log("Mapped: ", mapped);
    // console.log("Elites: ", elites);

    let elite_dna = [];
    for (const idx of elites) {
      elite_dna.push(population[idx]);
    }
    return elite_dna;
  }

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
    // console.log("Val: ", val);
    let idx = 0;
    while (val > 0) {
      val -= norm[idx];
      idx++;
    }
    idx--;
    // console.log("Norm: ", norm);
    // console.log("Idx: ", idx);

    return population[idx];
  }

  crossover(parentA, parentB) {
    // console.log("Parent A: ", parentA);
    // console.log("Parent B: ", parentB);

    let seg_len = Math.floor(parentA.length / 2);

    let start = Math.floor((parentA.length - seg_len) / 2);
    let end = start + seg_len;

    let a_segment = parentA.slice(start, end);
    let head = [];
    let tail = [];

    for (const el of parentB) {
      if (!a_segment.includes(el)) {
        if (head.length <= parentA.length - seg_len) {
          head.push(el);
        } else if (head.length + tail.length < parentA.length - seg_len) {
          tail.push(el);
        } else {
          break;
        }
      }
    }

    // console.log("seg_len: ", seg_len);
    // console.log("Start: ", start);
    // console.log("End: ", end);
    // console.log("Segment: ", a_segment);
    // console.log("Head: ", head);
    // console.log("Tail: ", tail);

    let childA = [].concat(head).concat(a_segment).concat(tail);

    // console.log("Child A: ", childA);

    return childA;
  }

  fitness(dna, costs, nodes, player_parcels) {
    //computing current carried score and number of carreied parcels
    let carriedParcels = Array.from(player_parcels);
    let currCarr = Array.from(player_parcels).length;
    let currRew = 0;
    for (const par of carriedParcels) {
      currRew += par[1];
    }

    //penality for each additional step. Makes sure the eagent eventually delivers the parcels
    let LONG_TRIP_PENALITY = 2.5;
    let real_duration = this.movement_duration * 4;
    let STEP_COST = real_duration / 1000 / this.parcel_decay;

    //console.log("STEP COST: ", STEP_COST);
    //exit();
    //console.log("DNA: ", dna);
    let rew = currRew;
    // console.log("start at node : ", dna[0]);

    // reward of first parcel minus cost of reaching it
    rew +=
      nodes[dna[0]].rew -
      Math.max(nodes[dna[0]].in_c * currCarr, 0) * STEP_COST;
    currCarr += 1;

    for (let i = 1; i < dna.length; i++) {
      rew +=
        nodes[dna[i]].rew -
        Math.max(costs[dna[i - 1]][dna[i]] * currCarr, 0) * STEP_COST -
        LONG_TRIP_PENALITY * currCarr; // - penality;
      currCarr += 1;
    }
    rew +=
      -Math.max(nodes[dna[dna.length - 1]].out_c * currCarr, 0) * STEP_COST;

    if (rew < 0) {
      rew = 0;
    }

    //console.log("Fitness: ", rew);
    return rew;
  }

  geneticTSP(
    costs,
    nodes,
    pop_size = 1000,
    gen_num = 100,
    mutation_rate = 0.1,
    elite_rate = 0.5,
    player_parcels = null
  ) {
    let genes = Array.from(Array(nodes.length).keys());
    // console.log("Genes: ", genes);
    if (genes.length == 0) {
      return [[], 0];
    }
    //this.printMat(costs);
    // console.log("Nodes: ", nodes);
    // console.log("Genes: ", genes);

    let best_dna = [];
    let best_fit = 0;
    let population = [];

    let skip_rate = 0.2; //TODO: check if skip rate works okay or not

    for (let i = 0; i < pop_size; i++) {
      let order = genes.slice();
      order = order.sort(() => Math.random() - 0.5);
      let masked = this.maskList(order, skip_rate);

      population.push(masked);
    }
    //population[0] = [];
    //console.log(population);

    let tot_fit = 0;
    for (const dna of population) {
      //console.log("DNA: ", dna);
      tot_fit += this.fitness(dna, costs, nodes, player_parcels);
    }
    //console.log("Average fitness: ", tot_fit / pop_size);
    this.iters += 1;
    this.avg_fit += tot_fit / pop_size;
    console.log(
      "AVG FIT: ",
      this.avg_fit / this.iters + " after " + this.iters
    );

    for (let i = 0; i < gen_num; i++) {
      let new_pop = [];
      const [scores, chances] = this.rouletteWheel(
        population,
        costs,
        nodes,
        player_parcels
      );
      let elites = this.getElites(population, scores, elite_rate);
      new_pop = new_pop.concat(elites);

      for (let j = 0; j < pop_size - elites.length; j += 2) {
        let parentA = this.pickOne(population, chances);
        let parentB = this.pickOne(population, chances);

        let childA = this.crossover(parentA, parentB);
        let childB = this.crossover(parentB, parentA);

        new_pop.push(childA);
        new_pop.push(childB);
      }
      // console.log("Population: ", population);
      // console.log("New population: ", new_pop);

      for (let j = 0; j < new_pop.length; j++) {
        if (Math.random() < mutation_rate) {
          let idxA = Math.floor(Math.random() * new_pop[j].length);
          let idxB = Math.floor(Math.random() * new_pop[j].length);
          let tmp = new_pop[j][idxA];
          new_pop[j][idxA] = new_pop[j][idxB];
          new_pop[j][idxB] = tmp;
        }
      }

      population = new_pop;

      tot_fit = 0;

      for (const dna of population) {
        let fit = this.fitness(dna, costs, nodes, player_parcels);
        tot_fit += fit;

        if (fit > best_fit) {
          best_fit = fit;
          best_dna = dna;
          //console.log("New best fit: ", best_fit);
        }
      }

      if (i % 10 == 0) {
        //console.log("Gen " + i + " avg fitness: ", tot_fit / pop_size);
        //console.log(population.length, " ", pop_size);
      }
    }

    return [best_dna, best_fit];
  }

  backupPlan(player_parcels) {
    let startTile = this.field.getTile({ x: this.x, y: this.y });
    let endTile = null;
    let deliver = false;
    let rew = 1;

    let path_to_closest = -1;
    let path_to_spawnable = -1;
    if (Array.from(player_parcels).length > 0) {
      for (const par of Array.from(player_parcels)) {
        rew += par[1];
      }
      console.log(
        "No parcels but agent is packing, going to closest delivery zone"
      );

      let closest = this.field.getClosestDeliveryZones({
        x: this.x,
        y: this.y,
      });

      if (closest.length == 0) {
        console.log("No delivery zones reachable");
      } else {
        path_to_closest = closest[0].path;
      }
    } else {
      console.log("No parcels on rider, generating random plan");
      path_to_spawnable = this.field.getRandomSpawnable(
        new Position(this.x, this.y)
      );
    }

    let actions = [];
    if (path_to_closest != -1) {
      console.log("[BACKUP] A reachable delivery zone was found!");
      actions = Action.pathToAction(path_to_closest, ActionType.PUTDOWN, null);
    } else if (path_to_spawnable != -1) {
      console.log("[BACKUP] A reachable spawnable tile was found!");
      actions = Action.pathToAction(path_to_spawnable, ActionType.MOVE, null);
    } else {
      console.log(
        "[BACKUP] No reachable delivery zone or spawnable tile was found!"
      );
      console.log("[BACKUP] Returning random reflexive move");

      let movement = null;
      let target_position = null;
      for (const dir in Direction) {
        target_position = new Position(this.x, this.y).moveTo(Direction[dir]);
        console.log("trying to move ", Direction[dir], " to ", target_position);
        if (
          !this.field.isTileUnreachable(this.field.getTile(target_position))
        ) {
          movement = Direction[dir];
          console.log("found walkable tile");
          break;
        } else {
          console.log("Tile is unreachable");
        }
      }

      actions = new Action(
        new Position(this.x, this.y),
        target_position,
        ActionType.MOVE,
        null
      );
    }

    console.log("Generated BACKUP plan with rew ", rew);
    return [actions, rew];
  }
  createPlan(player_parcels) {
    const [costs, paths, parc] = this.builGraphInOut();

    const [best_path, best_fit] = this.geneticTSP(
      costs,
      parc,
      this.pop,
      this.gen,
      0.01,
      0.5,
      player_parcels
    );

    console.log(
      "Generated plan with rew ",
      best_fit,
      " from position ",
      this.x,
      this.y
    );
    let parcels_path = [];
    for (const idx of best_path) {
      let par = parc[idx];
      parcels_path.push({
        pos: new Position(par.x, par.y),
        parcel: par.id,
        path_in: par.path_in,
        path_out: par.path_out,
      });
    }

    //console.log("chosen parcels: ", parcels_path);
    // console.log(paths);

    if (parcels_path.length == 0 || best_fit == 0) {
      return this.backupPlan(player_parcels);
    }

    //TODO:
    let plan = [];
    let actions = Action.pathToAction(
      parcels_path[0].path_in,
      ActionType.PICKUP,
      parcels_path[0].parcel
    );
    plan = plan.concat(actions);

    for (let i = 0; i < best_path.length; i++) {
      let curridx = best_path[i];
      if (i + 1 < best_path.length) {
        let nextidx = best_path[i + 1];
        let semi_path = paths[curridx][nextidx];

        actions = Action.pathToAction(
          semi_path,
          ActionType.PICKUP,
          parcels_path[i + 1].parcel
        );

        plan = plan.concat(actions);
      }
    }

    actions = Action.pathToAction(
      parcels_path[parcels_path.length - 1].path_out,
      ActionType.PUTDOWN,
      null
    );

    plan = plan.concat(actions);

    return [plan, best_fit];
  }

  testGen() {
    const [costs, parc] = this.builGraphInOut();

    let ers = [0.1, 0.2, 0.3, 0.4, 0.5];
    // for (const er of ers) {
    //   this.avgs[er] = 0;
    // }
    for (const er of ers) {
      const [best_path, best_fit] = this.geneticTSP(
        costs,
        parc,
        100,
        100,
        0.01,
        er
      );

      if (isNaN(this.avgs[er])) {
        this.avgs[er] = 0;
        this.avgs["cnt"] = 0;
      }
      this.avgs[er] += best_fit;
      this.avgs["cnt"] += 1;
      //console.log("Best fit ", er, " ", best_fit);
    }
    //console.log("Averages: ", this.avgs);
    for (const er of ers) {
      console.log(
        "Average fit ",
        er,
        " ",
        Math.round(this.avgs[er] / this.avgs["cnt"])
      );
    }
    //console.log("Averages: ", this.avgs);
    console.log("-----------------------------");
  }

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
