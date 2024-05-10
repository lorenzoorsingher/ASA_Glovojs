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

    console.log("Closest delivery zone: ", delivery);
    console.log("parcels: ", this.parcels);

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

  createPlan() {
    let [costs, nodes] = this.buildGraph();

    // costs = [
    //   [Infinity, 4, Infinity, Infinity, 1],
    //   [Infinity, Infinity, Infinity, Infinity, Infinity],
    //   [Infinity, 7, Infinity, -2, Infinity],
    //   [Infinity, 1, Infinity, Infinity, Infinity],
    //   [Infinity, Infinity, Infinity, -5, Infinity],
    // ];

    // console.log("Nodes: ");
    // console.log(nodes);
    //this.printMat(costs);
    //this.floydWarshall(costs, nodes);
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

  floydWarshall(costs, nodes) {
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
