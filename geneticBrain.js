import { Position } from "./data/position.js";
import { Action, ActionType } from "./data/action.js";

export class Genetic {
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

    for (const [key, p] of this.parcels.entries()) {
      let path_fromPlayer = this.field.bfs(
        this.field.getTile({ x: p.x, y: p.y }),
        this.field.getTile({ x: this.x, y: this.y })
      );
      let fromPlayer = path_fromPlayer.length - 1;

      let closest = this.field.getClosestDeliveryZones({
        x: p.x,
        y: p.y,
      })[0];
      let path_toZone = closest.path;
      let toZone = closest.distance - 1;

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

  rouletteWheel(population, costs, nodes, playerParcels) {
    let scores = [];
    let tot_fit = 0;
    for (const dna of population) {
      let fit = this.fitness(dna, costs, nodes, playerParcels);
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

  fitness(dna, costs, nodes, playerParcels) {
    let carriedParcels = Array.from(playerParcels);
    let currCarr = Array.from(playerParcels).length;
    let currRew = 0;
    for (const par of carriedParcels) {
      currRew += par[1];
    }

    let COST_MUL = 1;
    //console.log("DNA: ", dna);
    let rew = currRew;
    // console.log("start at node : ", dna[0]);

    currCarr += 1;
    rew += nodes[dna[0]].rew - nodes[dna[0]].in_c * currCarr * COST_MUL;

    for (let i = 1; i < dna.length; i++) {
      currCarr += 1;

      rew +=
        nodes[dna[i]].rew - costs[dna[i - 1]][dna[i]] * currCarr * COST_MUL; // - penality;
    }
    rew += -nodes[dna[dna.length - 1]].out_c * COST_MUL;

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
    playerParcels = null
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
    //console.log(population);

    let tot_fit = 0;
    for (const dna of population) {
      //console.log("DNA: ", dna);
      tot_fit += this.fitness(dna, costs, nodes, playerParcels);
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
        playerParcels
      );
      let elites = this.getElites(population, scores, elite_rate);
      new_pop = new_pop.concat(elites);
      // console.log("Scores: ", scores);
      // console.log("Chances: ", chances);
      // console.log("Elite dna: ", elites);
      for (let j = 0; j < pop_size - elites.length; j += 2) {
        let parentA = this.pickOne(population, chances);
        let parentB = this.pickOne(population, chances);

        let childA = this.crossover(parentA, parentB);
        let childB = this.crossover(parentB, parentA);

        // console.log("Parent A: ", parentA);
        // console.log("Parent B: ", parentB);
        // console.log("Child A: ", childA);
        // console.log("Child B: ", childB);
        // new_pop.push(child);
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
        let fit = this.fitness(dna, costs, nodes, playerParcels);
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

  backupPlan(playerParcels) {
    let startTile = this.field.getTile({ x: this.x, y: this.y });
    let endTile = null;
    let deliver = false;
    let rew = 1;
    if (Array.from(playerParcels).length > 0) {
      for (const par of Array.from(playerParcels)) {
        rew += par[1];
      }
      console.log(
        "No parcels but agent is packing, going to closest delivery zone"
      );
      endTile = this.field.getClosestDeliveryZone({
        x: this.x,
        y: this.y,
      });

      if (endTile == null) {
        console.log("No delivery zones reachable, generating random plan");
        endTile = this.field.getRandomSpawnable();
      } else {
        deliver = true;
      }
    } else {
      console.log("No parcels, generating random plan");
      endTile = this.field.getRandomSpawnable();
    }

    // #TODO something happening here
    if (endTile.position.equals(startTile.position)) {
      console.log("Already on the target tile, no need to move");

      let plan = [
        new Action(
          startTile.position,
          startTile.position,
          ActionType.PUTDOWN,
          null
        ),
      ];
      return [plan, 1];
    }

    let path = this.field.bfs(endTile, startTile);
    let actions = [];
    if (deliver) {
      actions = Action.pathToAction(path, ActionType.PUTDOWN, null);
    } else {
      actions = Action.pathToAction(path, ActionType.MOVE, null);
    }

    console.log("Generated BACKUP plan with rew ", rew);
    return [actions, rew];
  }
  createPlan(playerParcels) {
    const [costs, paths, parc] = this.builGraphInOut();

    const [best_path, best_fit] = this.geneticTSP(
      costs,
      parc,
      this.pop,
      this.gen,
      0.01,
      0.5,
      playerParcels
    );

    console.log("Generated plan with rew ", best_fit);
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

    // for (let i = 0; i < best_path.length; i++) {
    //   let curridx = best_path[i];
    //   if (i + 1 < best_path.length) {
    //     let nextidx = best_path[i + 1];
    //     console.log(curridx, " -> ", nextidx, " ", paths[curridx][nextidx]);
    //   }
    // }
    console.log("chosen parcels: ", parcels_path);

    // console.log(paths);

    if (parcels_path.length == 0 || best_fit == 0) {
      return this.backupPlan(playerParcels);
    }

    //TODO:
    let plan = [];
    // let startTile = this.field.getTile(new Position(this.x, this.y));
    // let endTile = this.field.getTile(parcels_path[0].pos);
    // let path = this.field.bfs(endTile, startTile);
    //console.log("path_in", parcels_path[0].path_in);
    let actions = Action.pathToAction(
      parcels_path[0].path_in,
      ActionType.PICKUP,
      parcels_path[0].parcel
    );
    plan = plan.concat(actions);

    // startTile = endTile;
    // for (let i = 1; i < parcels_path.length; i++) {
    //   endTile = this.field.getTile(parcels_path[i].pos);
    //   path = this.field.bfs(endTile, startTile);
    //   actions = Action.pathToAction(
    //     path,
    //     ActionType.PICKUP,
    //     parcels_path[i].parcel
    //   );
    //   plan = plan.concat(actions);
    //   startTile = endTile;
    // }

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

/*

2 : delivery zone
1 : walkable
0 : not walkable

map = [
    [0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    [2, 1, 1, 1, 1, 1, 1, 1, 1, 2],
    [0, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    [0, 0, 1, 0, 1, 0, 1, 0, 0, 2],
    [2, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    [0, 0, 1, 0, 1, 1, 1, 0, 0, 1],
    [0, 0, 1, 2, 1, 0, 1, 0, 0, 2]
]

*/
