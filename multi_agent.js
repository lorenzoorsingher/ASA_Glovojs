console.log("Starting...");
// import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import { Field } from "./data/field.js";
import { Position } from "./data/position.js";
// import { Genetic } from "./multi_geneticBrain.js";
import { MyServer } from "./server.js";
import { Action, ActionType } from "./data/action.js";
import { Rider } from "./muti_rider.js";

export const VERBOSE = false;
const LOCAL = true;

//let clients = [null, null];
let pop = 100;
let gen = 100;
let port = 3000;
// let [pop, gen, port] = process.argv.slice(2);
// if (pop == undefined) {
//   pop = 100;
// }
// if (gen == undefined) {
//   gen = 100;
// }

// if (port == undefined) {
//   port = 3000;
// }

console.log("Population: ", pop);
console.log("Generations: ", gen);

// if (LOCAL) {
//   for (let i = 0; i < clients.length; i++) {
//     let randomname =
//       "GLOVOJS" +
//       Math.random().toString(36).substring(5) +
//       "_" +
//       pop +
//       "_" +
//       gen;

//     clients[i] = new DeliverooApi(
//       "http://localhost:8080/?name=" + randomname,
//       ""
//     );
//   }
// }
//client = new DeliverooApi("http://localhost:8080/?name=" + randomname, "");
// } else {
//   client = new DeliverooApi(
//     "http://rtibdi.disi.unitn.it:8080/?name=GLOVOJS",
//     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijc5OWU1ZTkwM2ZjIiwibmFtZSI6IkdMT1ZPSlMiLCJpYXQiOjE3MTU2ODA3MzB9.WLbj404fa8vknsLtN6piMqvI6DCL4dGRr2Wm7FZ8iHs"
//   );
// }

const dashboard = new MyServer(port);

let map_init = false;
const map = new Field();

const NRIDERS = 3;
let riders = [];

for (let i = 0; i < NRIDERS; i++) {
  let uname = Math.random().toString(36).substring(5) + "_" + pop + "_" + gen;
  // brains.push(new Genetic());
  riders.push(new Rider(uname));
}

// const brain = new Genetic();
// const rider = new Rider();

let all_parcels = [];
const parcels = new Map();
const agents = new Map();
const blocking_agents = new Map();

let RESET_TIMEOUT = 50;
// contains the current plan

// hold loop until the map is loaded
//let wait_load = true;

riders.forEach((rider, index) => {
  //client = rider.client;
  //console.log(rider);
  rider.client.onConfig((config) => {
    rider.set_config(config);
    RESET_TIMEOUT = config.RESET_TIMEOUT;
  });

  // note that this happens before the onYou event
  rider.client.onMap((width, height, tiles) => {
    VERBOSE && console.log("Map received. Initializing...");

    //init map only once
    if (!map_init) {
      map.init(width, height, tiles, blocking_agents);
      map_init = true;
    }
    rider.brain.init(map, parcels, new Position(0, 0), pop, gen);
  });

  rider.client.onYou(({ id, name, x, y, score }) => {
    if (!rider.player_init) {
      rider.init(id, name, score, new Position(x, y));
      rider.player_init = true;
      //wait_load = false;
      rider.trg = rider.position;
      rider.brain.updatePlayerPosition(
        rider.trg,
        rider.config.MOVEMENT_DURATION
      );
    }
    rider.updatePosition(x, y);
  });

  rider.client.onParcelsSensing(async (perceived_parcels) => {
    map.set_parcels(perceived_parcels);
    all_parcels = perceived_parcels.slice();
    let parc_before = Array.from(parcels.keys());
    //console.log("Parcels before: ", parc_before);
    // console.log("Parcels perceived: ", perceived_parcels);
    // console.log("Parcels in memory: ", parcels);
    // console.log("Parcels carried: ", rider.parcels);

    for (const [key, value] of parcels.entries()) {
      let parc_pos = new Position(value.x, value.y);
      let dist = manhattanDistance(rider.position, parc_pos);

      //delete parcel if it's in memory but not perceived
      let found = false;
      if (dist < rider.config.PARCELS_OBSERVATION_DISTANCE) {
        for (const p of perceived_parcels) {
          if (p.id == key && p.carriedBy == null) {
            found = true;
            break;
          }
        }

        if (!found) {
          parcels.delete(key);
        }
      }
    }

    // if parcel not in memory, add it
    for (const p of perceived_parcels) {
      if (
        !parcels.has(p.id) &&
        hasCompletedMovement(rider.position) &&
        p.carriedBy == null
      ) {
        parcels.set(p.id, p);
      }
    }

    let parc_after = Array.from(parcels.keys());

    let changed = JSON.stringify(parc_before) != JSON.stringify(parc_after);
    if (changed) {
      console.log("Parcels changed. Recalculating plan");

      rider.newPlan();
    }
  });

  // rider.client.onAgentsSensing(async (perceived_agents) => {
  //   agents.clear();
  //   blocking_agents.clear();
  //   for (const a of perceived_agents) {
  //     if (a.name != "god") {
  //       if (manhattanDistance(rider.position, a) < 100) {
  //         blocking_agents.set(a.id, a);
  //       } else {
  //         agents.set(a.id, a);
  //       }
  //     }
  //   }
  // });
});

// PARCELS CLOCK
setInterval(() => {
  for (const [key, value] of parcels.entries()) {
    value.reward--;
    if (value.reward <= 0) {
      parcels.delete(key);
    } else {
      parcels.set(key, value);
    }
  }

  riders.forEach((rider) => {
    for (let [key, value] of rider.parcels.entries()) {
      value--;
      if (value <= 0) {
        rider.parcels.delete(key);
      } else {
        rider.parcels.set(key, value);
      }
    }
  });
}, 1000);

let lastPosition = new Position(0, 0);
// // HARD RESET
// setInterval(() => {
//   if (lastPosition.equals(rider.position)) {
//     console.log("HARD RESET--------------------------------------------------");
//     if (hasCompletedMovement(rider.position)) {
//       trg = rider.position;
//     }
//     rider.plan_fit = 0;
//     //rider.parcels.clear();
//     newPlan();
//   } else {
//     //console.log("NO RESET");
//   }
//   lastPosition.x = rider.position.x;
//   lastPosition.y = rider.position.y;
// }, RESET_TIMEOUT * Math.floor(Math.random() * 100) + 150);

// DASHBOARD UPDATE
setInterval(() => {
  let update_map = map.getMap();

  let riders_data = [];

  riders.forEach((rider) => {
    if (rider.player_init) {
      let plan_move = [];
      let plan_pickup = [];
      let plan_drop = [];
      let rider_parcels = [];

      if (rider.plan.length > 0) {
        for (const p of rider.plan) {
          switch (p.type) {
            case ActionType.MOVE:
              plan_move.push(p.source.serialize());
              break;
            case ActionType.PICKUP:
              plan_pickup.push(p.source.serialize());
              break;
            case ActionType.PUTDOWN:
              plan_drop.push(p.source.serialize());
              break;
          }
        }
      }

      if (rider.parcels.size > 0) {
        for (const [key, p] of rider.parcels.entries()) {
          rider_parcels.push({ key: key, reward: p.reward });
        }
      }

      riders_data.push({
        x: rider.position.x,
        y: rider.position.y,
        plan: [plan_move, plan_pickup, plan_drop],
        parcels: rider_parcels,
      });
    }
  });

  for (const [key, p] of parcels.entries()) {
    all_parcels.push({ x: p.x, y: p.y, reward: p.reward });
  }

  let dash_data = {
    map_size: [map.width, map.height],
    tiles: update_map,
    riders: riders_data,
    parc: all_parcels,
  };
  dashboard.emitMessage("map", dash_data);
}, 100);

function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function hasCompletedMovement(pos) {
  return pos.x % 1 === 0.0 && pos.y % 1 === 0.0;
}

// function isPathBlocked() {
//   let blocked = false;
//   for (const a of blocking_agents.values()) {
//     if (a.x == trg.x && a.y == trg.y) {
//       blocked = true;
//       break;
//     }
//   }

//   return blocked;
// }

let start = Date.now();

async function loop(rider) {
  // main loop
  while (true) {
    // wait for map and player to be loaded
    if (!rider.player_init) {
      await new Promise((res) => setTimeout(res, 300));
      continue;
    }

    rider.carrying = 0;
    rider.parcels.clear();
    for (const p of all_parcels) {
      if (p.carriedBy == rider.id) {
        rider.parcels.set(p.id, p.reward);
        rider.carrying += p.reward;
      }
    }

    // if a plan exists execute, otherwise create a new one
    if (rider.plan.length > 0) {
      // if the agent has completed the movement and brain has completed the plan
      if (hasCompletedMovement(rider.position) && !rider.planLock) {
        // if the agent has reached the previous target, update the nextAction
        if (!rider.trg.equals(rider.position)) {
          console.log("DIDNT REACH TARGET");
        } else {
          rider.nextAction = rider.plan.shift();
          rider.src = rider.nextAction.source;
          rider.trg = rider.nextAction.target;
        }

        // extract action information
        let move = Position.getDirectionTo(rider.src, rider.trg);

        // console.log("rider: ", rider.position);
        // console.log("Next action: ", nextAction);
        // console.log("stat: ", stat);
        // console.log("------------------------------------");
        // if the agent is not in the source tile, desync, something went wrong
        if (!rider.src.equals(rider.position)) {
          console.log("DESYNC DESYNC DESYNC");
          console.log("agent in  ", rider.position);
          //console.log(all_parcels);

          console.log(
            "[RECOVER] Trying to recover path, checking for reachability"
          );

          // if the agent is one tile off, try to recover
          if (manhattanDistance(rider.position, rider.src) <= 1) {
            console.log("SRC tile reachable. Going there");
            rider.plan.unshift(rider.nextAction);
            rider.nextAction = new Action(
              rider.position,
              rider.src,
              ActionType.MOVE
            );
            rider.src = rider.nextAction.source;
            rider.trg = rider.nextAction.target;
            move = Position.getDirectionTo(rider.src, rider.trg);

            console.log("moving from ", rider.src, " to ", rider.trg);
            console.log(rider.nextAction);
          } else {
            console.log("Agent too far from source. Game over.");
            exit();
          }
        }

        // if (isPathBlocked()) {
        //   trg = rider.position;
        //   console.log("Agent in the way. Recalculating plan");
        //   rider.plan_fit = 0;
        //   newPlan();
        //   continue;
        // }

        //avoid server spam
        while (Date.now() - start < rider.config.MOVEMENT_DURATION) {
          await new Promise((res) => setImmediate(res));
        }
        start = Date.now();

        //execute action
        switch (rider.nextAction.type) {
          case ActionType.MOVE:
            if (move != "none") {
              var stat = await rider.client.move(move);
            }
            break;
          case ActionType.PICKUP:
            await rider.client.pickup();

            try {
              rider.parcels.set(
                rider.nextAction.bestParcel,
                parcels.get(rider.nextAction.bestParcel).reward
              );
              parcels.delete(rider.nextAction.bestParcel);
            } catch (error) {
              console.error(
                "Parcel either expired or was deleted while executing plan."
              );
            }
            console.log("PICKING UP ", rider.nextAction.bestParcel);
            break;
          case ActionType.PUTDOWN:
            console.log("PUTTING DOWN");
            await rider.client.putdown();
            rider.parcels.clear();
            rider.plan_fit = 0;
            rider.newPlan();
            break;
        }
      }
    } else {
      console.log("Plan is empty. Recalculating plan");
      rider.plan_fit = 0;
      rider.newPlan();
    }
    await new Promise((res) => setImmediate(res));
  }
}

for (let i = 0; i < riders.length; i++) {
  loop(riders[i]);
}
// loop(riders[0]);
// // loop(riders[1]);
