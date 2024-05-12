import { Position } from "./data/position.js";
import { Action, ActionType } from "./data/action.js";
import { VERBOSE } from "./agent.js";
import e from "express";

export class TSP {
  init(field, parcels, playerPosition) {
    this.field = field;
    this.parcels = parcels;
    this.x = playerPosition.x;
    this.y = playerPosition.y;
    this.avgs = {};

    // this.plan = this.createPlan(parcelsQueue)
  }

  updateField(field) {
    this.field = field;
  }

  updatePlayerPosition(pos) {
    this.x = pos.x;
    this.y = pos.y;
  }
  buildGraph() {
    let closest = this.field.getClosestDeliveryZones({ x: this.x, y: this.y });

    let delivery = new Position(closest[0].x, closest[0].y);

    // console.log("Closest delivery zone: ", delivery);
    // console.log("parcels: ", this.parcels);

    let nodes = [];

    nodes.push({ node: new Position(this.x, this.y), reward: 0 });
    nodes.push({ node: delivery, reward: 0 });

    for (const [parcelId, parcel] of this.parcels.entries()) {
      nodes.push({
        node: new Position(parcel.x, parcel.y),
        reward: parcel.reward,
      });
    }

    //console.log("Nodes: ", nodes);
    let costs = [];

    for (let i = 0; i < nodes.length; i++) {
      costs[i] = [];
      let st = nodes[i].node;

      for (let j = 0; j < nodes.length; j++) {
        if (i == j) {
          costs[i][j] = Infinity;
        } else if (j == 0 || i == 1) {
          costs[i][j] = Infinity;
        } else {
          let end = nodes[j].node;

          let stTile = this.field.getTile(st);

          let endTile = this.field.getTile(end);

          costs[i][j] =
            this.field.bfs(endTile, stTile).length - nodes[j].reward;
        }
      }
    }

    // console.log("Costs: ");
    // let str = "";
    // for (const row of costs) {
    //   for (const cell of row) {
    //     str += cell + "\t";
    //   }
    //   str += "\n";
    // }
    // console.log(str);
    return [costs, nodes];
  }

  buildSubGraph(parc) {
    //console.log("Nodes: ", nodes);
    let costs = [];

    for (let i = 0; i < parc.length; i++) {
      costs[i] = [];

      for (let j = 0; j < parc.length; j++) {
        if (i == j) {
          costs[i][j] = Infinity;
        } else {
          let stTile = this.field.getTile({
            x: parc[i].x,
            y: parc[i].y,
          });

          let endTile = this.field.getTile({
            x: parc[j].x,
            y: parc[j].y,
          });

          costs[i][j] = this.field.bfs(endTile, stTile).length;
        }
      }
    }

    this.printMat(costs);
    return costs;
  }
  sort_by_key(array, key) {
    return array.sort(function (a, b) {
      var x = a[key];
      var y = b[key];
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }

  builGraphInOut(parc) {
    const MUL = 2;

    let prep_parcels = [];
    for (const [key, p] of this.parcels.entries()) {
      let fromPlayer =
        this.field.bfs(
          this.field.getTile({ x: this.x, y: this.y }),
          this.field.getTile({ x: p.x, y: p.y })
        ).length - 1;
      let toZone =
        this.field.getClosestDeliveryZones({
          x: p.x,
          y: p.y,
        })[0].distance - 1;

      let inc = fromPlayer;
      let outc = toZone;

      prep_parcels.push({
        x: p.x,
        y: p.y,
        rew: p.reward,
        in_c: inc,
        out_c: outc,
        id: key,
      });
    }

    let costs = [];

    for (let i = 0; i < prep_parcels.length; i++) {
      costs[i] = [];

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

          costs[i][j] = this.field.bfs(endTile, stTile).length;
        }
      }
    }

    //this.printMat(costs);
    return [costs, prep_parcels];
  }

  bruteTSP(costs, nodes) {
    console.log("Brute forcing TSP...");

    let best = this.sort_by_key(nodes, "reward").reverse();
    console.log("Nodes: ", best);

    let size = best.length;

    let best_path = [];
    let best_score = -Infinity;
    const res = [];
    const comb_num = 2 ** size;
    for (let comb_idx = 0; comb_idx < comb_num; comb_idx += 1) {
      const subSet = [];
      for (let el_idx = 0; el_idx < nodes.length; el_idx += 1) {
        if (comb_idx & (1 << el_idx)) {
          subSet.push(el_idx);
        }
      }
      if (subSet.length == 0) {
        continue;
      }

      let rew = nodes[subSet[0]].reward;
      for (let k = 1; k < subSet.length - 1; k++) {
        rew += costs[subSet[k]][subSet[k + 1]];
        rew -= costs[subSet[k - 1]][subSet[k]];
      }

      res.push({ subSet, reward: rew });

      if (rew > best_score) {
        best_score = rew;
        best_path = subSet;
      }
    }
    // console.log("Res: ", res);
    // console.log("Best path: ", best_path);
    // console.log("Best score: ", best_score);

    return [best_path, best_score];
  }

  notTSP(costs, nodes) {
    console.log(nodes);
    this.printMat(costs);

    console.log("Brute forcing TSP...");

    let best = this.sort_by_key(nodes, "reward").reverse();
    console.log("Nodes: ", best);

    let size = best.length;

    let best_path = [];
    let best_score = -Infinity;
    const res = [];
    const comb_num = 2 ** size;
    for (let comb_idx = 0; comb_idx < comb_num; comb_idx += 1) {
      const subSet = [];
      for (let el_idx = 0; el_idx < nodes.length; el_idx += 1) {
        if (comb_idx & (1 << el_idx)) {
          subSet.push(el_idx);
        }
      }
      if (subSet.length == 0) {
        continue;
      }

      let best_entry = 0;
      let best_entry_val = -1;
      let sub_nodes = [];
      let entry = 0;
      for (let k = 0; k < subSet.length - 1; k++) {
        let entry = nodes[subSet[k]];
        if (entry.rew - entry.in_c > best_entry_val) {
          best_entry = k;
          best_entry_val = entry.rew - entry.in_c;
        }
        sub_nodes.push(entry);
      }

      let visited = [entry];
      let curr = entry;

      let next_best = entry;
      let next_best_val = -1;

      for (let l = 0; l <= subSet.length; l++) {
        for (let k = 0; k <= subSet.length; k++) {
          k_node = nodes[subSet[k]];
          if (visited.includes(k_node)) {
            continue;
          }
        }
      }

      console.log(sub_nodes);
      console.log("Vis: ", visited);
    }
    console.log("Res: ", res);
    // console.log("Best path: ", best_path);
    // console.log("Best score: ", best_score);

    return [best_path, best_score];
  }

  // getRandomMask(size, p) {
  //   let mask = [];
  //   for (let i = 0; i < size; i++) {
  //     mask.push(Math.random() < p ? 1 : 0);
  //   }
  //   return mask;
  // }

  maskList(list, p) {
    let num_del = list.length - Math.floor(Math.random() * list.length + 1);

    for (let i = 0; i < num_del; i++) {
      let idx = Math.floor(Math.random() * list.length);
      list.splice(idx, 1);
    }
    return list;
  }

  getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }

  rouletteWheel(population, costs, nodes) {
    let scores = [];
    let tot_fit = 0;
    for (const dna of population) {
      let fit = this.fitness(dna, costs, nodes);
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
  fitness(dna, costs, nodes) {
    let rew = 0;
    // console.log("start at node : ", dna[0]);
    rew += nodes[dna[0]].rew - nodes[dna[0]].in_c;

    for (let i = 1; i < dna.length; i++) {
      // console.log("from node : ", dna[i - 1], " to node : ", dna[i]);
      // console.log("costs: ", costs[dna[i - 1]][dna[i]]);
      // console.log("reward: ", nodes[dna[i]].rew);
      rew += nodes[dna[i]].rew - costs[dna[i - 1]][dna[i]];
    }
    rew += -nodes[dna[dna.length - 1]].out_c;

    if (rew < 0) {
      rew = 0;
    }
    //console.log("Fitness: ", rew);
    return rew;
  }

  geneticTSP(
    costs,
    nodes,
    pop_size = 100,
    gen_num = 100,
    mutation_rate = 0.1,
    elite_rate = 0.5
  ) {
    let genes = Array.from(Array(nodes.length).keys());

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

    //console.log("Population: ", population);

    let tot_fit = 0;
    for (const dna of population) {
      //console.log("DNA: ", dna);
      tot_fit += this.fitness(dna, costs, nodes);
    }
    //console.log("Average fitness: ", tot_fit / pop_size);

    for (let i = 0; i < gen_num; i++) {
      let new_pop = [];
      const [scores, chances] = this.rouletteWheel(population, costs, nodes);
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
        let fit = this.fitness(dna, costs, nodes);
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

  createPlan() {
    const [costs, parc] = this.builGraphInOut();

    const [best_path, best_fit] = this.geneticTSP(
      costs,
      parc,
      100,
      100,
      0.01,
      0.5
    );

    let parcels_path = [];
    for (const idx of best_path) {
      let par = parc[idx];
      parcels_path.push({ pos: new Position(par.x, par.y), parcel: par.id });
    }

    console.log(parcels_path);

    let plan = [];
    let startTile = this.field.getTile(new Position(this.x, this.y));
    let endTile = this.field.getTile(parcels_path[0].pos);
    let path = this.field.bfs(endTile, startTile);
    let actions = Action.pathToAction(
      path,
      ActionType.PICKUP,
      parcels_path[0].parcel
    );
    plan = plan.concat(actions);
    startTile = endTile;
    for (let i = 1; i < parcels_path.length; i++) {
      endTile = this.field.getTile(parcels_path[i].pos);
      path = this.field.bfs(endTile, startTile);
      actions = Action.pathToAction(
        path,
        ActionType.PICKUP,
        parcels_path[i].parcel
      );
      plan = plan.concat(actions);
      startTile = endTile;
    }

    let delivery = this.field.getClosestDeliveryZone(endTile.position);
    path = this.field.bfs(delivery, endTile);
    actions = Action.pathToAction(path, ActionType.PUTDOWN, null);
    plan = plan.concat(actions);

    return plan;
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

  createPlanTmp() {
    let costs = this.buildGraph();
    // costs = [
    //   [Infinity, 4, Infinity, Infinity, 1],
    //   [Infinity, Infinity, Infinity, Infinity, Infinity],
    //   [Infinity, 7, Infinity, -2, Infinity],
    //   [Infinity, 1, Infinity, Infinity, Infinity],
    //   [Infinity, Infinity, Infinity, -5, Infinity],
    // ];
    this.johnsonSP(costs, 0, 1);

    return [];
  }

  johnsonSP(costs, start, end) {
    this.printMat(costs);
    console.log("Starting Bellman-Ford...");
    let norm_costs = this.bellmanFordNorm(costs);
    this.printMat(norm_costs);
    console.log("Starting Djikstra...");

    this.djikstraSP(norm_costs, start, end);

    console.log("Johnson's completed!");
  }

  djikstraSP(costs, start, end) {
    let dist = Array(costs.length).fill(Infinity);
    dist[start] = 0;

    let q = [];
    let par = Array(costs.length).fill(-1);
    dist[start] = 0;
    q.push(start);

    while (q.length > 0) {
      const node = q.shift();
      let distance = dist[node];
      for (let ne = 0; ne < costs[node].length; ne++) {
        //check if edge exists

        if (costs[node][ne] < Infinity) {
          //console.log("Node: ", node, " Ne: ", ne);
          //   dist[ne] = dist[node] + costs[node][ne];
          let new_dist = distance + costs[node][ne];
          if (dist[ne] > new_dist) {
            dist[ne] = new_dist;
            par[ne] = node;
            q.push(ne);
          }
        }
      }
    }

    let cur_node = end;
    let path = [cur_node];
    while (par[cur_node] != -1) {
      path.push(par[cur_node]);
      cur_node = par[cur_node];
    }
    path = path.reverse();
    console.log("Dist: ", dist);
    console.log("Path: ", path);
  }

  bellmanFordNorm(costs) {
    let D = Array(costs.length + 1).fill(Infinity);
    //let costs_axp = costs.slice();
    let costs_axp = Array(costs.length + 1)
      .fill(0)
      .map((x) => Array(costs.length + 1).fill(-1));
    D[D.length - 1] = 0;

    let V_n = 0;
    //SETUP EXTRA NODE
    for (let i = 0; i < costs.length; i++) {
      for (let j = 0; j < costs.length; j++) {
        costs_axp[i][j] = costs[i][j];
        if (costs_axp[i][j] < Infinity) {
          V_n++;
        }
      }
      costs_axp[i][costs.length] = Infinity;
    }
    for (let i = 0; i < costs.length + 1; i++) {
      costs_axp[costs.length][i] = 0;
      V_n++;
    }
    costs_axp[costs.length][costs.length] = Infinity;

    console.log("V_n: ", V_n);

    console.log("D: ", D);
    //relax edges
    for (let k = 0; k < V_n - 1; k++) {
      for (let i = 0; i < costs_axp.length; i++) {
        for (let j = 0; j < costs_axp.length; j++) {
          if (costs_axp[i][j] < Infinity) {
            //console.log(i, " -> ", j);
            if (D[j] > D[i] + costs_axp[i][j]) {
              //   console.log("D[v]: ", D[j]);
              //   console.log("D[u]: ", D[i]);
              //   console.log("w(u,v): ", costs_axp[i][j]);
              D[j] = D[i] + costs_axp[i][j];
            }
          }
        }
      }
    }
    this.printMat(costs_axp);
    console.log("D: ", D);
    console.log("Normalizing costs...");
    //normalize costs
    for (let i = 0; i < costs.length; i++) {
      for (let j = 0; j < costs.length; j++) {
        costs[i][j] = D[i] + costs[i][j] - D[j];
      }
    }
    //console.log("-------------");
    // console.log("D: ", D);
    // console.log("NORM COSTS:");
    // this.printMat(costs);

    return costs;
  }

  floydWarshallSP(costs, nodes) {
    let n = costs.length;
    let dp = costs.slice();
    let next = Array(n)
      .fill(0)
      .map((x) => Array(n).fill(-1));

    //SETUP
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (costs[i][j] < Infinity) {
          next[i][j] = j;
        }
      }
    }

    for (let k = 0; k < n; k++) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (dp[i][j] > dp[i][k] + dp[k][j]) {
            dp[i][j] = dp[i][k] + dp[k][j];
            next[i][j] = next[i][k];
          }
        }
      }
    }
    console.log("dp: ", ...dp);
    this.printMat(next);
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
