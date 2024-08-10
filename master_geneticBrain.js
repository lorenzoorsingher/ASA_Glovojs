import { Position, Direction } from "./data/position.js";
import { Action, ActionType } from "./data/action.js";

export class Genetic {
  constructor(riders, field, parcels, pop, gen) {
    this.riders = riders;
    this.nriders = riders.length;

    console.log("Genetic brain created with ", this.nriders, " riders");

    this.config = {};

    this.field = field;
    this.parcels = parcels;
    this.plan_fit = 0;
    this.planLock = false;
    // this.x = playerPosition.x;
    // this.y = playerPosition.y;
    this.pop = pop;
    this.gen = gen;

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

  sort_by_key(array, key) {
    return array.sort(function (a, b) {
      var x = a[key];
      var y = b[key];
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }

  builGraphInOut(rider) {
    const MUL = 2;

    let prep_parcels = [];
    let dummy_parcel = {
      x: rider.trg.x,
      y: rider.trg.y,
      reward: -Infinity,
    };

    let copy_parcels = new Map(this.parcels);
    copy_parcels.set("rider", dummy_parcel);

    for (const [key, p] of copy_parcels.entries()) {
      //console.log("rp: ", rider.trg);
      let path_fromPlayer = this.field.bfs(
        this.field.getTile({ x: p.x, y: p.y }),

        this.field.getTile({ x: rider.trg.x, y: rider.trg.y }),
        rider.blocking_agents
      );
      let fromPlayer;
      if (path_fromPlayer == -1) {
        rider.log("No path from player to parcel " + key);
        // console.log("No path from player to parcel ", key);
        console.log(p);
        fromPlayer = Infinity;
      } else {
        fromPlayer = path_fromPlayer.length - 1;
      }

      let closest = this.field.getClosestDeliveryZones(
        {
          x: p.x,
          y: p.y,
        },
        rider.blocking_agents
      );

      let path_toZone;
      let toZone;

      if (closest.length == 0) {
        toZone = Infinity;
        path_toZone = -1;
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

          let path = this.field.bfs(endTile, stTile, rider.blocking_agents);
          if (path.length == 0 || path == -1) {
            costs[i][j] = Infinity;
            paths[i][j] = [];
            // console.log("No path from ", i, " to ", j, " nodes unreaachabl");
          } else {
            paths[i][j] = path;
            costs[i][j] = path.length;
          }
        }
      }
    }

    //this.printMat(costs);
    // console.log("all paths: ", paths);
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

  rouletteWheel(population, riders_paths) {
    let scores = [];
    let tot_fit = 0;

    for (const family of population) {
      let fit = this.fitness(family, riders_paths);
      // console.log("Fit: ", fit);
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

  multi_crossover(parentA, parentB) {
    // console.log("INSIDE CROSSOVER");
    // console.log("Parent A: \t", parentA);
    // console.log("Parent B: \t", parentB);

    let childs = [];
    for (let r = 0; r < this.nriders; r++) {
      let dnaA = parentA[r];
      let dnaB = parentB[r];

      // console.log("\n\n");
      // console.log("dnaA: ", dnaA);
      // console.log("dnaB: ", dnaB);

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
      //console.log("Child: ", child);
    }
    // console.log("seg_len: ", seg_len);
    // console.log("Start: ", start);
    // console.log("End: ", end);
    // console.log("Segment: ", a_segment);
    // console.log("Head: ", head);
    // console.log("Tail: ", tail);
    let subl_len = [];
    for (let i = 0; i < childs.length; i++) {
      subl_len.push({ len: childs[i].length, idx: i });
    }
    subl_len = this.sort_by_key(subl_len, "len");
    // console.log("Subl len: ", subl_len);

    // console.log("childs: \t", childs);

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

    let ordered_childs = [];
    for (let i = 0; i < clean_childs.length; i++) {
      ordered_childs[subl_len[i].idx] = clean_childs[i];
    }

    return ordered_childs;
  }

  fitness(family, rider_paths) {
    let cumulative_rew = 0;

    for (let r = 0; r < this.nriders; r++) {
      let player_parcels = Array.from(this.riders[r].player_parcels);
      let costs = rider_paths[r].costs;
      let nodes = rider_paths[r].nodes;
      let dna = family[r];

      if (dna.length == 0) {
        continue;
      }

      //computing current carried score and number of carreied parcels
      let carried_parcels = Array.from(player_parcels);
      let curr_carr = Array.from(player_parcels).length + 1;
      let curr_rew = 0;
      for (const par of carried_parcels) {
        curr_rew += par[1];
      }
      // console.log("Current reward: ", curr_rew);
      //penality for each additional step. Makes sure the eagent eventually delivers the parcels
      let NO_DELIVERY = this.riders[r].no_delivery;
      let LONG_TRIP_PENALITY = 0.2;
      // let real_duration = this.movement_duration * 4;
      // let STEP_COST = real_duration / 1000 / this.parcel_decay;

      let STEP_COST = 0.2 + LONG_TRIP_PENALITY; //+ (LONG_TRIP_PENALITY * NO_DELIVERY) / 100;

      let rew = curr_rew;

      // reward of first parcel minus cost of reaching it
      rew += nodes[dna[0]].rew - nodes[dna[0]].in_c * curr_carr * STEP_COST;

      curr_carr += 1;

      for (let i = 1; i < dna.length; i++) {
        rew +=
          nodes[dna[i]].rew - costs[dna[i - 1]][dna[i]] * STEP_COST * curr_carr;

        curr_carr += 1;
      }

      rew += -nodes[dna[dna.length - 1]].out_c; //* STEP_COST * curr_carr;

      // if (rew < 0) {
      //   rew = 0;
      // }

      cumulative_rew += rew;
    }
    return cumulative_rew;
  }

  geneticTSP(
    riders_paths,
    pop_size = 1000,
    gen_num = 100,
    mutation_rate = 0.1,
    elite_rate = 0.5,
    skip_rate = 0.2
  ) {
    let genes = [];

    for (let rid = 0; rid < this.nriders; rid++) {
      const r = riders_paths[rid];
      //console.log("Riders paths: ", r);

      //delivery onyl
      let agent = this.riders[rid];
      // console.log("Agent: ", agent);
      let closest = this.field.getClosestDeliveryZones(
        {
          x: agent.trg.x,
          y: agent.trg.y,
        },
        agent.blocking_agents
      );

      //TODO pass closest for ALL agents to fitness and let the fitness function decide if it's worth to deliver
      console.log("Closest: ", closest);
      let path_toZone;
      let toZone;
      let delivery_only = true;
      let delivery_only_fit = 0;
      if (closest.length == 0) {
        toZone = Infinity;
        path_toZone = -1;
        delivery_only_fit = -Infinity;
      } else {
        path_toZone = closest[0].path;
        toZone = closest[0].distance - 1;
      }

      genes = Array.from(Array(r.nodes.length).keys());
      // console.log("Genes: ", genes);

      if (genes.length == 0) {
        let empty_plan = Array.from({ length: this.riders.length }, () => []);
        console.log("No nodes reachable, returning empty plan ", empty_plan);
        return [empty_plan, 0];
      }
      // this.printMat(r.costs);
      // console.log("N Nodes: ", r.nodes.length);
      // console.log("Nodes: ", r.nodes);
      // console.log("Genes: ", genes);
    }

    let best_dna = [];
    let best_fit = 0;
    let population = [];

    for (let i = 0; i < pop_size; i++) {
      let order = genes.slice();
      order = order.sort(() => Math.random() - 0.5);
      let masked = this.maskList(order, skip_rate);

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

    let tot_fit = 0;
    for (const family of population) {
      //console.log("DNA: ", dna);
      tot_fit += this.fitness(family, riders_paths);
    }
    this.iters += 1;
    this.avg_fit += tot_fit / pop_size;

    for (let i = 0; i < gen_num; i++) {
      let new_pop = [];

      const [scores, chances] = this.rouletteWheel(population, riders_paths);

      // console.log("Scores: ", scores);
      // console.log("Chances: ", chances);

      let elites = this.getElites(population, scores, elite_rate);
      new_pop = new_pop.concat(elites);

      for (let j = 0; j < pop_size - elites.length; j += 2) {
        let parentA = this.pickOne(population, chances);
        let parentB = this.pickOne(population, chances);

        // console.log("Parent A: ", parentA);
        // console.log("Parent B: ", parentB);

        let childA = this.multi_crossover(parentA, parentB);
        let childB = this.multi_crossover(parentB, parentA);

        new_pop.push(childA);
        new_pop.push(childB);
      }
      // console.log("Population: ", population);
      // console.log("New population: ", new_pop);

      for (let j = 0; j < new_pop.length; j++) {
        if (Math.random() < mutation_rate) {
          let idxFamA = Math.floor(Math.random() * new_pop[j].length);
          let idxFamB = Math.floor(Math.random() * new_pop[j].length);

          let idxA = Math.floor(Math.random() * new_pop[j][idxFamA].length);
          let idxB = Math.floor(Math.random() * new_pop[j][idxFamB].length);

          if (
            new_pop[j][idxFamA][idxA] == undefined ||
            new_pop[j][idxFamB][idxB] == undefined
          ) {
            continue;
          }

          let tmp = new_pop[j][idxFamA][idxA];
          new_pop[j][idxFamA][idxA] = new_pop[j][idxFamB][idxB];
          new_pop[j][idxFamB][idxB] = tmp;
        }
      }

      population = new_pop;

      tot_fit = 0;

      for (const family of population) {
        let fit = this.fitness(family, riders_paths);
        tot_fit += fit;

        if (fit > best_fit) {
          best_fit = fit;
          best_dna = family;
          // console.log("New best fit: ", best_fit);
        }
      }

      // if (i % 5 == 0) {
      //   console.log("Gen " + i + " avg fitness: ", tot_fit / pop_size);
      //   //console.log(population.length, " ", pop_size);
      // }
    }

    if (best_fit == 0) {
      let empty_plan = Array.from({ length: this.nriders }, () => []);
      console.log("Best fit is zero, returning empty plan ", empty_plan);
      best_dna = empty_plan;
    }

    // this.printMat(riders_paths[0].costs);

    for (let r = 0; r < this.nriders; r++) {
      let family = best_dna[r];
      console.log("Best family: ", family);

      for (const dna of family) {
        console.log("DNA: ", riders_paths[r].nodes[dna]);
        if (riders_paths[r].nodes[dna].in_c == Infinity) {
          console.log("Infinite in_c");
          //saaa = 999;
        }
      }

      //aa = 0;
    }

    return [best_dna, best_fit];
  }

  backupPlan(rider) {
    // console.log("Generating backup plan for rider ", rider.name);
    // console.log("Rider position: ", rider.position);
    // console.log("Rider target: ", rider.trg);
    // console.log("Rider source: ", rider.src);
    // console.log("Rider action: ", rider.nextAction);

    // let startTile = this.field.getTile({
    //   x: rider.src.x,
    //   y: rider.src.y,
    // });
    // let endTile = null;
    // let deliver = false;
    let rew = 1;

    let path_to_closest = -1;
    let path_to_spawnable = -1;
    if (Array.from(rider.player_parcels).length > 0) {
      for (const par of Array.from(rider.player_parcels)) {
        rew += par[1];
      }
      console.log("Agent is packing, going to closest delivery zone");

      let closest = this.field.getClosestDeliveryZones(
        {
          x: rider.trg.x,
          y: rider.trg.y,
        },
        rider.blocking_agents
      );

      if (closest.length == 0) {
        rider.log("No delivery zones reachable");
      } else {
        path_to_closest = closest[0].path;
      }
    } else {
      rider.log("No parcels on rider, generating random plan");
      path_to_spawnable = this.field.getRandomSpawnable(
        new Position(rider.trg.x, rider.trg.y),
        rider.blocking_agents
      );
    }

    let actions = [];
    // let starting_action = new Action(
    //   rider.src,
    //   rider.trg,
    //   ActionType.MOVE,
    //   null
    // );
    // actions.push(starting_action);

    if (path_to_closest != -1) {
      console.log("[BACKUP] A reachable delivery zone was found!");
      actions = Action.pathToAction(path_to_closest, ActionType.PUTDOWN, null);
    } else if (path_to_spawnable != -1) {
      console.log("[BACKUP] A reachable spawnable tile was found!");
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
        console.log("trying to move ", Direction[dir], " to ", target_position);
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
      // console.log("Starting action inserted");
      // plan.push(starting_action);
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
    //assa = 3;

    // for (const act of actions) {
    //   act.printAction();
    // }

    console.log("[BRAIN] Generated BACKUP plan with rew ", rew);
    return [actions, rew];
  }

  createPlan() {
    let riders_paths = [];
    console.log("starting positions: ");
    for (const r of this.riders) {
      r.log("Rider at: " + r.trg.x + " " + r.trg.y);
      const [costs, paths, parc] = this.builGraphInOut(r);
      riders_paths.push({
        costs: costs,
        paths: paths,
        nodes: parc,
      });
    }

    // for (const p of riders_paths) {
    //   console.log("Rider ", this.riders.indexOf(p).name);
    //   console.log("Riders paths: ", p);
    // }

    const [best_path, best_fit] = this.geneticTSP(
      riders_paths,
      this.pop,
      this.gen,
      0.3,
      0.5
    );

    // console.log("Generated plan with rew ", best_fit);
    console.log("Plan: ", best_path);

    // console.log("chosen parcels: ", parcels_path);
    //console.log(paths);

    //TODO:
    let parcels_path = Array.from({ length: this.nriders }, () => []);
    let all_plans = [];
    for (let r = 0; r < this.nriders; r++) {
      let plan = [];

      if (best_path[r].length == 0 || best_fit == 0) {
        plan = this.backupPlan(this.riders[r]);

        //console.log("Backup plan for Rider ", plan);
        //aaa = 33;
        console.log("[BRAIN] Backup plan generated");
        all_plans.push(plan[0]);
        continue;
      }

      // ??? TODO

      for (const idx of best_path[r]) {
        let par = riders_paths[r].nodes[idx];

        // console.log("par.path_out: ", par);
        parcels_path[r].push({
          pos: new Position(par.x, par.y),
          parcel: par.id,
          path_in: par.path_in,
          path_out: par.path_out,
          inc: par.in_c,
        });

        // if (par.path_in == -1 || par.path_in == undefined) {
        //   this.riders[r].log("No path in for parcel ", par);
        //   console.log("No path in for parcel ", par);
        //   asd = 99;
        // }
      }
      let chosen_path = parcels_path[r];

      let starting_action = new Action(
        this.riders[r].src,
        this.riders[r].trg,
        ActionType.MOVE,
        null
      );
      // console.log("Starting action inserted: ", starting_action);
      plan.push(starting_action);
      console.log(chosen_path[0]);
      let actions = Action.pathToAction(
        chosen_path[0].path_in,
        ActionType.PICKUP,
        chosen_path[0].parcel
      );
      plan = plan.concat(actions);

      for (let i = 0; i < best_path[r].length; i++) {
        let curridx = best_path[r][i];
        if (i + 1 < best_path[r].length) {
          let nextidx = best_path[r][i + 1];
          let semi_path = riders_paths[r].paths[curridx][nextidx];

          actions = Action.pathToAction(
            semi_path,
            ActionType.PICKUP,
            chosen_path[i + 1].parcel
          );

          plan = plan.concat(actions);
        }
      }

      if (chosen_path[chosen_path.length - 1].path_out == undefined) {
        console.log("Undefined path out");
        console.log("choe: ", chosen_path);
      }

      actions = Action.pathToAction(
        chosen_path[chosen_path.length - 1].path_out,
        ActionType.PUTDOWN,
        null
      );

      plan = plan.concat(actions);

      // let corr_plan = [];
      // for (let i = 1; i < plan.length; i += 1) {
      //   if (plan[i].type == ActionType.PICKUP) {
      //     for (let j = 1; j < i; j++) {
      //       if (plan[j].type == ActionType.MOVE) {
      //         if (plan[j].source.equals(plan[i].source)) {
      //           // console.log(
      //           //   "###################################################################"
      //           // );
      //           // console.log("CONFLICT IN PICKUP ORDER: ", plan[i]);
      //           corr_plan = [];
      //           corr_plan = corr_plan.concat(plan.slice(0, j));
      //           corr_plan = corr_plan.concat(plan.slice(i, i + 1));
      //           corr_plan = corr_plan.concat(plan.slice(j, i));
      //           corr_plan = corr_plan.concat(plan.slice(i + 1, plan.length));
      //           plan = corr_plan;

      //           i = 0;
      //           j = 0;
      //           break;
      //         }
      //       }
      //     }
      //   }
      // }

      all_plans.push(plan);
    }

    for (let r = 0; r < this.nriders; r++) {
      console.log("Plan for Rider ", this.riders[r].name);
      // console.log("Plan: ", all_plans[r]);
      // console.log("len: ", all_plans[r].length, " ", all_plans.length);
      for (const act of all_plans[r]) {
        // console.log("Action: ", act);
        act.printAction();
      }
    }
    return [all_plans, best_fit];
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

  newPlan() {
    // console.log("MyPos: ", rider.position);
    this.planLock = true;
    const [tmp_plan, best_fit] = this.createPlan();

    console.log("proposed fit ", best_fit, " current fit ", this.plan_fit);
    let MINIMUM_GAIN = 1.2;
    if (best_fit > this.plan_fit * MINIMUM_GAIN || this.plan_fit == 0) {
      this.plan_fit = best_fit;

      for (let i = 0; i < this.nriders; i++) {
        this.riders[i].plan = tmp_plan[i];
        // if (
        //   this.riders[i].position.x % 1 == 0.0 &&
        //   this.riders[i].position.y % 1 == 0.0
        // ) {
        //   // console.log("Rider ", this.riders[i].position, " is on a tile");
        //   this.riders[i].trg.set(this.riders[i].position);
        // }
      }

      console.log("New plan accepted ✅");
    } else {
      console.log("New plan rejected ❌");
    }

    this.planLock = false;
  }

  justDelivered(rider) {
    let plan = this.backupPlan(rider);
    rider.plan = plan[0];
  }
}
