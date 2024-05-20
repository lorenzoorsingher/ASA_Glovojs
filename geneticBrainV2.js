import { Position } from "./data/position.js";
import { Action, ActionType } from "./data/action.js";
import { VERBOSE } from "./agent.js";
import e from "express";

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
    return array.sort((a, b) => a[key] - b[key]);
  }

  builGraphInOut() {
    const prep_parcels = this.parcels.map((p, key) => {
      const fromPlayer = this.field.bfs(
        this.field.getTile({ x: this.x, y: this.y }),
        this.field.getTile({ x: p.x, y: p.y })
      ).length - 1;
      const toZone = this.field.getClosestDeliveryZones({ x: p.x, y: p.y })[0].distance - 1;

      return {
        x: p.x,
        y: p.y,
        rew: p.reward,
        in_c: fromPlayer,
        out_c: toZone,
        id: key,
      };
    });

    const costs = prep_parcels.map((_, i) => 
      prep_parcels.map((_, j) => 
        i === j ? Infinity : this.field.bfs(
          this.field.getTile({ x: prep_parcels[i].x, y: prep_parcels[j].y }),
          this.field.getTile({ x: prep_parcels[j].x, y: prep_parcels[i].y })
        ).length
      )
    );

    return [costs, prep_parcels];
  }

  maskList(list) {
    const num_del = list.length - (Math.floor(Math.random() * list.length) + 1);
    for (let i = 0; i < num_del; i++) {
      const idx = Math.floor(Math.random() * list.length);
      list.splice(idx, 1);
    }
    return list;
  }

  getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }

  rouletteWheel(population, costs, nodes, playerParcels) {
    const scores = population.map(dna => this.fitness(dna, costs, nodes, playerParcels));
    const tot_fit = scores.reduce((acc, score) => acc + score, 0);
    const chances = scores.map(score => Math.round((score / tot_fit) * scores.length));
    return [scores, chances];
  }

  getElites(population, scores, elite_rate) {
    const num_elites = Math.round(scores.length * elite_rate);
    return scores
      .map((score, idx) => ({ index: idx, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, num_elites)
      .map(elite => population[elite.index]);
  }

  pickOne(population, chances) {
    const total = chances.reduce((acc, chance) => acc + chance, 0);
    const normalized = chances.map(chance => chance / total);
    let val = Math.random();
    for (let i = 0; i < normalized.length; i++) {
      val -= normalized[i];
      if (val <= 0) return population[i];
    }
  }

  crossover(parentA, parentB) {
    const seg_len = Math.floor(parentA.length / 2);
    const start = Math.floor((parentA.length - seg_len) / 2);
    const end = start + seg_len;

    const a_segment = parentA.slice(start, end);
    const [head, tail] = parentB.reduce(
      ([head, tail], el) => {
        if (!a_segment.includes(el)) {
          if (head.length < parentA.length - seg_len) head.push(el);
          else tail.push(el);
        }
        return [head, tail];
      },
      [[], []]
    );

    return head.concat(a_segment, tail);
  }

  fitness(dna, costs, nodes, playerParcels) {
    let currCarr = playerParcels.length;
    let currRew = playerParcels.reduce((acc, par) => acc + par[1], 0);
    const COST_MUL = 1;

    const rew = dna.reduce((acc, idx, i) => {
      currCarr++;
      return acc + nodes[idx].rew - (i === 0 ? nodes[idx].in_c : costs[dna[i - 1]][idx]) * currCarr * COST_MUL;
    }, currRew);

    return Math.max(rew - nodes[dna[dna.length - 1]].out_c * COST_MUL, 0);
  }

  geneticTSP(
    costs,
    nodes,
    pop_size = 1000,
    gen_num = 100, 
    mutation_rate = 0.1, 
    elite_rate = 0.5, 
    playerParcels = []
  ) {
    const genes = Array.from(Array(nodes.length).keys());
    if (genes.length === 0) return [[], 0];

    let best_dna = [];
    let best_fit = 0;
    let population = Array.from({ length: pop_size }, () => this.maskList([...genes].sort(() => Math.random() - 0.5)));

    for (let i = 0; i < gen_num; i++) {
      const [scores, chances] = this.rouletteWheel(population, costs, nodes, playerParcels);
      const elites = this.getElites(population, scores, elite_rate);

      const new_pop = [...elites];
      while (new_pop.length < pop_size) {
        const parentA = this.pickOne(population, chances);
        const parentB = this.pickOne(population, chances);
        new_pop.push(this.crossover(parentA, parentB));
        if (new_pop.length < pop_size) new_pop.push(this.crossover(parentB, parentA));
      }

      population = new_pop.map(dna => {
        if (Math.random() < mutation_rate) {
          const idxA = Math.floor(Math.random() * dna.length);
          const idxB = Math.floor(Math.random() * dna.length);
          [dna[idxA], dna[idxB]] = [dna[idxB], dna[idxA]];
        }
        return dna;
      });

      const gen_best_fit = Math.max(...scores);
      if (gen_best_fit > best_fit) {
        best_fit = gen_best_fit;
        best_dna = population[scores.indexOf(gen_best_fit)];
      }
    }

    return [best_dna, best_fit];
  }

  backupPlan(playerParcels) {
    const startTile = this.field.getTile({ x: this.x, y: this.y });
    let endTile = null;
    let deliver = false;
    let rew = 1;
    if (playerParcels.length > 0) {
      rew += playerParcels.reduce((acc, par) => acc + par[1], 0);
      endTile = this.field.getClosestDeliveryZone({ x: this.x, y: this.y });
      if (endTile == null) {
        endTile = this.field.getRandomSpawnable();
      } else {
        deliver = true;
      }
    } else {
      endTile = this.field.getRandomSpawnable();
    }

    if (endTile.position.equals(startTile.position)) {
      return [[new Action(startTile.position, startTile.position, ActionType.PUTDOWN, null)], 1];
    }

    const path = this.field.bfs(endTile, startTile);
    const actions = Action.pathToAction(path, deliver ? ActionType.PUTDOWN : ActionType.MOVE, null);

    return [actions, rew];
  }

  createPlan(playerParcels) {
    const [costs, parcels] = this.builGraphInOut();
    const [best_path, best_fit] = this.geneticTSP(costs, parcels, this.pop, this.gen, 0.01, 0.5, playerParcels);

    if (best_path.length === 0 || best_fit === 0) {
      return this.backupPlan(playerParcels);
    }

    const plan = [];
    let startTile = this.field.getTile(new Position(this.x, this.y));
    for (const idx of best_path) {
      const endTile = this.field.getTile(new Position(parcels[idx].x, parcels[idx].y));
      const path = this.field.bfs(endTile, startTile);
      plan.push(...Action.pathToAction(path, ActionType.PICKUP, parcels[idx].id));
      startTile = endTile;
    }

    const delivery = this.field.getClosestDeliveryZone(startTile.position);
    if (delivery) {
      const path = this.field.bfs(delivery, startTile);
      plan.push(...Action.pathToAction(path, ActionType.PUTDOWN, null));
    }

    return [plan, best_fit];
  }

  testGen() {
    const [costs, parcels] = this.builGraphInOut();
    const elite_rates = [0.1, 0.2, 0.3, 0.4, 0.5];
    for (const er of elite_rates) {
      const [best_path, best_fit] = this.geneticTSP(costs, parcels, 100, 100, 0.01, er);
      this.avgs[er] = (this.avgs[er] || 0) + best_fit;
      this.avgs.cnt = (this.avgs.cnt || 0) + 1;
    }
    for (const er of elite_rates) {
      console.log("Average fit", er, Math.round(this.avgs[er] / this.avgs.cnt));
    }
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