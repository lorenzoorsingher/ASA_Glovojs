console.log("Starting...");
import { Field } from "./data/field.js";
import { Position } from "./data/position.js";
import { MyServer } from "./dashboard/server.js";
import { Action, ActionType } from "./data/action.js";
import { Rider } from "./rider.js";
import { Genetic } from "./geneticBrain.js";
import { Beliefset } from "@unitn-asa/pddl-client";
import { manhattanDistance, hasCompletedMovement, parseArgs } from "./utils.js";
export const VERBOSE = false;

const [
  USE_PDDL,
  BLOCKING_DISTANCE,
  BOOST,
  CLS_DLV,
  CLS_PAR,
  NRIDERS,
  POP,
  GEN,
  PORT,
  PREFIX,
  PRC_OBS,
] = parseArgs(process.argv);

console.log("Use PDDL: ", USE_PDDL);
console.log("Blocking Distance: ", BLOCKING_DISTANCE);
console.log("Boost: ", BOOST);
console.log("DLV Classes: ", CLS_DLV);
console.log("PAR Classes: ", CLS_PAR);
console.log("Number of Riders: ", NRIDERS);
console.log("Port: ", PORT);
console.log("Population: ", POP);
console.log("Generations: ", GEN);
console.log("Prefix: ", PREFIX);
console.log("Parcel Observation Distance: ", PRC_OBS);

const dashboard = new MyServer(PORT);

let map_init = false;
let all_players_ready = false;
const map = new Field(USE_PDDL, CLS_DLV, BOOST); // contains the game map
const parcels = new Map(); // contains all non-carried parcels

let PARCEL_DECAY = 1000;

// create riders
let riders = [];
let names = ["BLUE", "PINK", "GREY", "GREEN", "BLACK", "WHITE"];
let uname = "";
for (let i = 0; i < NRIDERS; i++) {
  //let uname = Math.random().toString(36).substring(5) + "_" + pop + "_" + gen;
  uname = PREFIX + "_" + names[i] + "_" + POP + "_" + GEN;
  riders.push(new Rider(uname));
}

//create brain with associated riders
let brain = new Genetic(riders, map, parcels, POP, GEN, CLS_PAR);
let agentsBeliefSet;
let parcelsBeliefSet;

// set up sensings for all riders
riders.forEach((rider, index) => {
  rider.client.onConfig((config) => {
    rider.setConfig(config);
    brain.setConfig(config);

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
      rider.init(id, name, new Position(x, y), brain);
      rider.player_init = true;
      rider.trg.set(rider.position);

      let all_ready = true;
      for (const r of riders) {
        if (!r.player_init) {
          all_ready = false;
          break;
        }
      }
      all_players_ready = all_ready;
    }
    rider.updatePosition(x, y);
    rider.score = score;
  });

  parcelsBeliefSet = new Beliefset();

  rider.client.onParcelsSensing(async (perceived_parcels) => {
    let parc_before = Array.from(parcels.keys());

    // if memorized parcels in the sensing range are not present
    // anymore, remove them from the parcels list
    for (const [key, value] of parcels.entries()) {
      // console.log("value: ", value);
      let parc_pos = new Position(value.x, value.y);
      let found = false;
      let dist = manhattanDistance(rider.position, parc_pos);

      //if (dist < rider.config.PARCELS_OBSERVATION_DISTANCE) {
      if (dist < rider.config.PARCELS_OBSERVATION_DISTANCE && dist < PRC_OBS) {
        for (const p of perceived_parcels) {
          if (p.id == key && p.carriedBy == null) {
            parcelsBeliefSet.declare(`parcel_t${p.x}_${p.y}`);
            found = true;
            break;
          }
        }
        if (!found) {
          parcelsBeliefSet.undeclare(`parcel_t${value.x}_${value.y}`);
          parcels.delete(key);

          for (let act of rider.plan) {
            if (act.action_parcel == key) {
              rider.log("Parcel STOLEN");
              brain.plan_fit = 0;
              await brain.newPlan();
              break;
            }
          }
        }
      }
    }

    // update and add free parcels and
    // update rider parcels and carried value
    let carried_parcels = new Map();
    let carrying = 0;
    for (const p of perceived_parcels) {
      let parc_pos = new Position(p.x, p.y);
      let dist = manhattanDistance(rider.position, parc_pos);
      if (dist < PRC_OBS) {
        if (p.carriedBy == null) {
          parcels.set(p.id, p);
        } else if (p.carriedBy == rider.id) {
          carried_parcels.set(p.id, p.reward);
          carrying += p.reward;
        }
      }
    }

    // if rider is in the process of putting down and the
    // sensing reveals that the rider is not carrying any parcels,
    // confirm delivery and ask for new plan. Otherwise, update carrying value
    if (rider.putting_down) {
      if (carrying <= 0) {
        rider.carrying = 0;
        rider.player_parcels.clear();

        rider.log("Delivered, asking for new plan");
        brain.plan_fit = 0;
        await brain.newPlan();
        rider.putting_down = false;
      }
    } else {
      rider.carrying = carrying;
      rider.player_parcels = carried_parcels;
    }

    let parc_after = Array.from(parcels.keys());

    // if parcels have changed during the sensing, recalculate plan
    let changed = JSON.stringify(parc_before) != JSON.stringify(parc_after);
    if (changed) {
      console.log("[SENSING] Parcels changed. Recalculating plan");
      await brain.newPlan();
    }
  });

  agentsBeliefSet = new Beliefset();

  rider.client.onAgentsSensing(async (perceived_agents) => {
    // if other agents are within BLOCKING_DISTANCE blocks
    // of the rider, add them to its blocking_agents list

    // reset blocking agents every time the sensing is updated
    rider.blocking_agents.clear();
    // clear belief set
    // for (const a of perceived_agents) {
    //   agentsBeliefSet.undeclare(`agent_t${a.x}_${a.y}`);
    // }
    // Undeclare all agents currently stored in the belief set
    agentsBeliefSet.objects.forEach((obj) => {
      agentsBeliefSet.undeclare(obj);
    });

    for (const a of perceived_agents) {
      if (a.name != "god") {
        if (
          manhattanDistance(rider.position, a) < BLOCKING_DISTANCE ||
          rider.trg.equals(a)
        ) {
          // console.log("Agent blocking: ", a);
          rider.blocking_agents.set(a.id, a);
          agentsBeliefSet.declare(`agent_t${a.x}_${a.y}`);
        }
      }
    }
  });
});

// PARCELS CLOCK
setInterval(() => {
  riders.forEach((rider) => {
    // reduce reward of parcels that are not in the sensing range
    for (const [key, value] of parcels.entries()) {
      // console.log("value2: ", value);
      let parc_pos = new Position(value.x, value.y);
      let dist = manhattanDistance(rider.position, parc_pos);
      if (
        dist >= rider.config.PARCELS_OBSERVATION_DISTANCE ||
        dist >= PRC_OBS
      ) {
        value.reward--;
        if (value.reward <= 0) {
          parcels.delete(key);
        } else {
          parcels.set(key, value);
        }
      }
    }
  });
}, PARCEL_DECAY);

// DASHBOARD UPDATE
setInterval(() => {
  //organize all the logging data to be sent to the dashboard
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
          let move_id = Position.serialize(p.source);
          switch (p.type) {
            case ActionType.MOVE:
              plan_move.push(move_id);
              break;
            case ActionType.PICKUP:
              plan_pickup.push(move_id);
              break;
            case ActionType.PUTDOWN:
              plan_drop.push(move_id);
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
        // console.log("blk: ", blk);
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
  for (const [key, p] of parcels.entries()) {
    // console.log("p: ", p)
    dash_parcels.push({ x: p.x, y: p.y, reward: p.reward });
  }

  let dash_data = {
    map_size: [map.width, map.height],
    tiles: update_map,
    riders: riders_data,
    parc: dash_parcels,
  };

  dashboard.emitMessage("map", dash_data);
}, 100);

/**
 * Main loop for the agents
 *
 * @param {Rider} rider
 */
async function loop(rider) {
  // main loop
  while (true) {
    // wait for map and player to be loaded
    if (!all_players_ready) {
      await new Promise((res) => setTimeout(res, 300));
      continue;
    }

    if (!rider.plan) {
      rider.plan = [];
    }

    // if a plan exists execute, otherwise create a new one
    if (rider.plan.length > 0) {
      // if the agent has completed the movement and brain has completed the plan
      if (hasCompletedMovement(rider.position) && !brain.planLock) {
        // pick action from plan (depending on when planning was started
        // agent might at the first or second step)
        if (rider.position.equals(rider.plan[0].source)) {
          rider.nextAction = rider.plan.shift();
        } else if (rider.plan.length > 1) {
          if (rider.position.equals(rider.plan[1].source)) {
            rider.nextAction = rider.plan.shift();
            rider.nextAction = rider.plan.shift();
          } else {
            rider.log("No match found for next action");
            rider.log(rider.position);
            rider.log(rider.nextAction);
            rider.log(
              "should be ",
              rider.plan[0].source,
              " OR ",
              rider.plan[1].source
            );
          }
        } else {
          rider.log("Agent appears to be stuck on last move");
          rider.log("Retrying last move");
        }

        //update agent position and target
        rider.src.set(rider.nextAction.source);
        rider.trg.set(rider.nextAction.target);
        rider.no_delivery++;

        // extract action information
        let move = Position.getDirectionTo(rider.src, rider.trg);

        // check if the path is blocked
        if (rider.isPathBlocked()) {
          rider.trg.set(rider.position);
          rider.log("Agent in the way. Recalculating plan");
          brain.plan_fit = 0;
          await brain.newPlan();
          continue;
        }

        //avoid server spam
        while (
          Date.now() - rider.rider_timer <
          rider.config.MOVEMENT_DURATION / 2
        ) {
          await new Promise((res) => setImmediate(res));
        }
        rider.rider_timer = Date.now();
        //execute action
        switch (rider.nextAction.type) {
          case ActionType.MOVE:
            if (move != "none") {
              await rider.client.move(move);
            }
            break;
          case ActionType.PICKUP:
            await rider.client.pickup();

            try {
              rider.player_parcels.set(
                rider.nextAction.action_parcel,
                parcels.get(rider.nextAction.action_parcel).reward
              );
              parcels.delete(rider.nextAction.action_parcel);
            } catch (error) {
              rider.log(
                "Parcel either expired or was deleted while executing plan."
              );
            }
            rider.log("PICKING UP ", rider.nextAction.action_parcel);
            break;
          case ActionType.PUTDOWN:
            rider.log("PUTTING DOWN");
            await rider.client.putdown();

            if (!rider.putting_down && rider.carrying > 0) {
              rider.putting_down = true;
            }
            break;
          default:
        }
      }
    } else {
      if (rider.putting_down) {
        // rider.log("Empty plan but waiting for delivery to complete");
      } else {
        if (Date.now() - rider.plan_cooldown > 1000) {
          rider.plan_cooldown = Date.now();
          // rider.log("Plan is empty. Recalculating plan");
          brain.plan_fit = 0;
          rider.log("Asking for new plan");
          await brain.newPlan();
        }
      }
    }

    await new Promise((res) => setImmediate(res));
  }
}

// start the loop for all riders
for (let i = 0; i < riders.length; i++) {
  loop(riders[i]);
}

export { parcelsBeliefSet, agentsBeliefSet, map };
