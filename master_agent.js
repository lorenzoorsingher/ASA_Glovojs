console.log("Starting...");
// import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import { Field } from "./data/field.js";
import { Position } from "./data/position.js";
// import { Genetic } from "./multi_geneticBrain.js";
import { MyServer } from "./server.js";
import { Action, ActionType } from "./data/action.js";
import { Rider } from "./master_rider.js";
import { Genetic } from "./master_geneticBrain.js";

export const VERBOSE = false;
const LOCAL = true;

let pop = 100;
let gen = 30;
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

const dashboard = new MyServer(port);

let map_init = false;
const map = new Field();
let all_parcels = [];
// contains all non-carried parcels
const parcels = new Map();

const NRIDERS = 1;
let PARCEL_DECAY = 1000;
let riders = [];

let names = ["BLUE", "PINK", "GREY"];

// create riders
for (let i = 0; i < NRIDERS; i++) {
  let uname = Math.random().toString(36).substring(5) + "_" + pop + "_" + gen;
  uname = names[i];
  riders.push(new Rider(uname));
}

//create brain with associated riders
let brain = new Genetic(riders, map, parcels, pop, gen);

let RESET_TIMEOUT = 50;

// set up sensings for all riders
riders.forEach((rider, index) => {
  rider.client.onConfig((config) => {
    rider.set_config(config);
    brain.set_config(config);
    RESET_TIMEOUT = config.RESET_TIMEOUT;

    if (config.PARCEL_DECADING_INTERVAL == "infinite") {
      PARCEL_DECAY = Infinity;
    } else {
      PARCEL_DECAY = config.PARCEL_DECADING_INTERVAL * 1000;
    }
  });

  // note that this happens before the onYou event
  rider.client.onMap((width, height, tiles) => {
    VERBOSE && console.log("Map received. Initializing...");

    //init map only once
    if (!map_init) {
      map.init(width, height, tiles);
      map_init = true;
    }
    //rider.brain.init(map, parcels, new Position(0, 0), pop, gen);
  });

  rider.client.onYou(({ id, name, x, y, score }) => {
    if (!rider.player_init) {
      rider.init(id, name, score, new Position(x, y), brain);
      rider.player_init = true;
      rider.trg.set(rider.position);
      if (rider.position.x % 1 != 0.0 || rider.position.y % 1 != 0.0) {
        console.log("DESYNC");
        azz = 8;
      }
    }
    rider.updatePosition(x, y);
  });

  rider.client.onParcelsSensing(async (perceived_parcels) => {
    map.set_parcels(perceived_parcels);
    all_parcels = perceived_parcels.slice();
    let parc_before = Array.from(parcels.keys());

    for (const [key, value] of parcels.entries()) {
      let parc_pos = new Position(value.x, value.y);
      let found = false;
      for (const r of riders) {
        let dist = manhattanDistance(r.position, parc_pos);

        if (dist < r.config.PARCELS_OBSERVATION_DISTANCE) {
          for (const p of perceived_parcels) {
            if (p.id == key && p.carriedBy == null) {
              found = true;
              break;
            }
          }
        }
      }
      if (!found) {
        parcels.delete(key);
      }
    }

    // update and add free parcels
    for (const p of perceived_parcels) {
      if (p.carriedBy == null) {
        parcels.set(p.id, p);
      }
    }

    // update rider parcels and carried value
    rider.carrying = 0;
    rider.player_parcels.clear();
    for (const p of all_parcels) {
      if (p.carriedBy == rider.id) {
        rider.player_parcels.set(p.id, p.reward);
        rider.carrying += p.reward;
      }
    }

    let parc_after = Array.from(parcels.keys());

    let changed = JSON.stringify(parc_before) != JSON.stringify(parc_after);
    if (changed) {
      console.log("Parcels changed. Recalculating plan");

      brain.newPlan();
    }
  });

  rider.client.onAgentsSensing(async (perceived_agents) => {
    rider.blocking_agents.clear();
    for (const a of perceived_agents) {
      if (a.name != "god") {
        if (manhattanDistance(rider.position, a) < 100) {
          rider.blocking_agents.set(a.id, a);
        }
      }
    }
  });
});

// // PARCELS CLOCK
// setInterval(() => {
//   for (const [key, value] of parcels.entries()) {
//     value.reward--;
//     if (value.reward <= 0) {
//       parcels.delete(key);
//     } else {
//       parcels.set(key, value);
//     }
//   }

//   riders.forEach((rider) => {
//     for (let [key, value] of rider.player_parcels.entries()) {
//       value--;
//       if (value <= 0) {
//         rider.player_parcels.delete(key);
//       } else {
//         rider.player_parcels.set(key, value);
//       }
//     }
//   });
// }, PARCEL_DECAY);

// let lastPosition = new Position(0, 0);
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

      if (rider.player_parcels.size > 0) {
        for (const [key, p] of rider.player_parcels.entries()) {
          rider_parcels.push({ key: key, reward: p });
        }
      }

      let blk_agents = [];
      for (const blk of rider.blocking_agents.values()) {
        blk_agents.push(blk.x + "-" + blk.y);
      }

      riders_data.push({
        x: rider.position.x,
        y: rider.position.y,
        plan: [plan_move, plan_pickup, plan_drop],
        parcels: rider_parcels,
        blk_agents: blk_agents,
      });
    }
  });
  let dash_parcels = [];
  // console.log("parcc ", parcels);
  for (const [key, p] of parcels.entries()) {
    dash_parcels.push({ x: p.x, y: p.y, reward: p.reward });
  }

  let dash_data = {
    map_size: [map.width, map.height],
    tiles: update_map,
    riders: riders_data,
    parc: dash_parcels,
  };

  //console.log(dash_data);
  dashboard.emitMessage("map", dash_data);
}, 200);

function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function hasCompletedMovement(pos) {
  return pos.x % 1 === 0.0 && pos.y % 1 === 0.0;
}

let start = Date.now();

async function loop(rider) {
  // main loop
  while (true) {
    // wait for map and player to be loaded
    if (!rider.player_init) {
      await new Promise((res) => setTimeout(res, 300));
      continue;
    }

    // if a plan exists execute, otherwise create a new one
    if (rider.plan.length > 0) {
      // if the agent has completed the movement and brain has completed the plan
      if (hasCompletedMovement(rider.position) && !brain.planLock) {
        // if the agent has reached the previous target, update the nextAction

        if (rider.position.equals(rider.plan[0].source)) {
          rider.nextAction = rider.plan.shift();
          console.log("action consumed 1");
        } else if (rider.position.equals(rider.plan[1].source)) {
          rider.nextAction = rider.plan.shift();
          rider.nextAction = rider.plan.shift();
          console.log("action consumed 2");
        } else {
          console.log("SOMETHING WENT VERY WRONG HERE");
          console.log(
            "rider is in position ",
            rider.position,
            " and hes supposed to be either in ",
            rider.plan[0].source,
            " or ",
            rider.plan[1].source
          );
          console.log(rider.plan[0].type, " and ", rider.plan[1].type);
        }
        rider.src.set(rider.nextAction.source);
        rider.trg.set(rider.nextAction.target);

        // if (!rider.trg.equals(rider.position)) {
        //   console.log("DIDNT REACH TARGET");
        // } else {
        //   rider.nextAction = rider.plan.shift();
        //   rider.src = rider.nextAction.source;
        //   rider.trg = rider.nextAction.target;
        // }

        // extract action information
        let move = Position.getDirectionTo(rider.src, rider.trg);

        // console.log("rider: ", rider.position);
        console.log("Next action: ", rider.nextAction);
        // console.log("stat: ", stat);
        // console.log("------------------------------------");
        // if the agent is not in the source tile, desync, something went wrong

        // if (!rider.src.equals(rider.position)) {
        //   console.log("DESYNC DESYNC DESYNC");
        //   console.log("agent in  ", rider.position, " instead of ", rider.src);
        //   //console.log(all_parcels);

        //   console.log(
        //     "[RECOVER] Trying to recover path, checking for reachability"
        //   );

        //   // if the agent is one tile off, try to recover
        //   if (manhattanDistance(rider.position, rider.src) <= 1) {
        //     console.log("SRC tile reachable. Going there");
        //     rider.plan.unshift(rider.nextAction);
        //     rider.nextAction = new Action(
        //       rider.position,
        //       rider.src,
        //       ActionType.MOVE
        //     );
        //     rider.src = rider.nextAction.source;
        //     rider.trg = rider.nextAction.target;
        //     move = Position.getDirectionTo(rider.src, rider.trg);

        //     console.log("moving from ", rider.src, " to ", rider.trg);
        //     console.log(rider.nextAction);
        //   } else {
        //     console.log("Agent too far from source. Game over.");
        //     exit();
        //   }
        // }

        if (rider.isPathBlocked()) {
          rider.trg.set(rider.position);
          if (rider.position.x % 1 != 0.0 || rider.position.y % 1 != 0.0) {
            console.log("DESYNC");
            azz = 8;
          }
          console.log("Agent in the way. Recalculating plan");
          brain.plan_fit = 0;
          brain.newPlan();
          continue;
        }

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
              rider.player_parcels.set(
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
            rider.player_parcels.clear();
            brain.justDelivered(rider);
            break;
        }
      }
    } else {
      console.log("Plan is empty. Recalculating plan");
      brain.plan_fit = 0;
      brain.newPlan();
    }
    await new Promise((res) => setImmediate(res));
  }
}

for (let i = 0; i < riders.length; i++) {
  loop(riders[i]);
}
