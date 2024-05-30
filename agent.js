import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import { Field } from "./data/field.js";
import { Position } from "./data/position.js";
import { Genetic } from "./geneticBrain.js";
import myServer from "./server.js";
import { Action, ActionType } from "./data/action.js";
import { Rider } from "./rider.js";

export const VERBOSE = false;
const LOCAL = true;

let client = null;

let [pop, gen] = process.argv.slice(2);
if (pop == undefined) {
  pop = 1000;
}
if (gen == undefined) {
  gen = 100;
}

console.log("Population: ", pop);
console.log("Generations: ", gen);

let randomname = "GLOVOJS";
Math.random().toString(36).substring(5) + "_" + pop + "_" + gen;

if (LOCAL) {
  client = new DeliverooApi("http://localhost:8080/?name=" + randomname, "");
} else {
  client = new DeliverooApi(
    "http://rtibdi.disi.unitn.it:8080/?name=GLOVOJS",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijc5OWU1ZTkwM2ZjIiwibmFtZSI6IkdMT1ZPSlMiLCJpYXQiOjE3MTU2ODA3MzB9.WLbj404fa8vknsLtN6piMqvI6DCL4dGRr2Wm7FZ8iHs"
  );
}

const map = new Field();
const brain = new Genetic();
const rider = new Rider();

const parcels = new Map();
const agents = new Map();
const blocking_agents = new Map();

let RESET_TIMEOUT = 50;
// contains the current plan

// hold loop until the map is loaded
let wait_load = true;

// player position
// parcels carried by the player
let allParcels = [];

client.onConfig((config) => {
  rider.set_config(config);
  RESET_TIMEOUT = config.RESET_TIMEOUT;
});

// note that this happens before the onYou event
client.onMap((width, height, tiles) => {
  VERBOSE && console.log("Map received. Initializing...");
  map.init(width, height, tiles, blocking_agents);
  brain.init(map, parcels, new Position(0, 0), pop, gen);
});

let player_init = false;

client.onYou(({ id, name, x, y, score }) => {
  if (!player_init) {
    rider.init(id, name, score, new Position(x, y));
    player_init = true;
  }
  rider.updatePosition(x, y);
  if (hasCompletedMovement(rider.position)) {
    brain &&
      brain.updatePlayerPosition(
        rider.position,
        rider.config.MOVEMENT_DURATION
      );
    wait_load = false;
  }
});

client.onParcelsSensing(async (perceived_parcels) => {
  map.set_parcels(perceived_parcels);
  allParcels = perceived_parcels.slice();
  let parc_before = Array.from(parcels.keys());
  //console.log("Parcels before: ", parc_before);

  for (const [key, value] of parcels.entries()) {
    let parc_pos = new Position(value.x, value.y);
    let dist = manhattanDistance(rider.position, parc_pos);

    let found = false;
    if (dist < rider.config.PARCELS_OBSERVATION_DISTANCE) {
      for (const p of perceived_parcels) {
        if (p.id == key) {
          found = true;
          break;
        }
      }

      if (!found) {
        parcels.delete(key);
      }
    }
  }

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

    newPlan();
  }
});

client.onAgentsSensing(async (perceived_agents) => {
  agents.clear();
  blocking_agents.clear();
  for (const a of perceived_agents) {
    if (a.name != "god") {
      if (manhattanDistance(rider.position, a) < 100) {
        blocking_agents.set(a.id, a);
      } else {
        agents.set(a.id, a);
      }
    }
  }
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

  for (let [key, value] of rider.parcels.entries()) {
    value--;
    if (value <= 0) {
      rider.parcels.delete(key);
    } else {
      rider.parcels.set(key, value);
    }
  }
}, 1000);

let lastPosition = new Position(0, 0);
// HARD RESET
setInterval(() => {
  if (lastPosition.equals(rider.position)) {
    console.log("HARD RESET--------------------------------------------------");

    isMoving = false;
    trg = null;
    rider.plan_fit = 0;
    rider.parcels.clear();
    newPlan();
    //console.log("PLAN::: ", plan);
  } else {
    console.log("NO RESET");
  }
  console.log("Last: ", lastPosition);
  console.log("Current: ", rider.position);
  lastPosition.x = rider.position.x;
  lastPosition.y = rider.position.y;
}, RESET_TIMEOUT * Math.floor(Math.random() * 100) + 150);

// DASHBOARD UPDATE
setInterval(() => {
  let update_map = map.getMap();
  let plan_move = [];
  let plan_pickup = [];
  let plan_drop = [];

  let agent_parcels = [];

  let adv_agents = [];
  let blk_agents = [];
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

  for (const [key, p] of parcels.entries()) {
    agent_parcels.push({ x: p.x, y: p.y, reward: p.reward });
  }
  for (const [key, p] of agents.entries()) {
    adv_agents.push({ x: p.x, y: p.y });
  }
  for (const [key, p] of blocking_agents.entries()) {
    blk_agents.push({ x: p.x, y: p.y });
  }
  let car = "";
  for (const [key, p] of rider.parcels.entries()) {
    car += key + " ";
  }
  let dash_data = {
    map_size: [map.width, map.height],
    tiles: update_map,
    agent: [rider.position.x, rider.position.y],
    plan: [plan_move, plan_pickup, plan_drop, "TILE"],
    parc: agent_parcels,
    agents: adv_agents,
    blk_agents: blk_agents,
  };
  myServer.emitMessage("map", dash_data);
}, 100);

function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function hasCompletedMovement(pos) {
  return pos.x % 1 === 0.0 && pos.y % 1 === 0.0;
}

let nextAction = null;
let isMoving = false;
let trg = null;
let src = null;

function newPlan() {
  // console.log("MyPos: ", rider.position);
  const [tmp_plan, best_fit] = brain.createPlan(rider.parcels);

  // console.log("Best fit: ", best_fit);
  if (best_fit > rider.plan_fit) {
    rider.plan_fit = best_fit;
    rider.plan = tmp_plan;
    console.log("New plan accepted");
  } else {
    console.log("New plan rejected");
  }
}

let start = Date.now();

async function loop() {
  while (true) {
    if (wait_load) {
      await new Promise((res) => setTimeout(res, 300));
      continue;
    }

    //console.log("allParcels: ", allParcels);
    for (const p of allParcels) {
      if (p.carriedBy == rider.id) {
        //console.log("Parcel carried by me");
        rider.parcels.set(p.id, p.reward);
      }
    }

    if (rider.plan.length > 0) {
      // console.log("never stopping");
      if (trg == null) {
        trg = rider.position;
      }

      if (trg && trg.equals(rider.position)) {
        isMoving = false;
        nextAction = rider.plan.shift();

        // for (const d of map.getDeliveryZones()) {
        //   if (trg.equals(d)) {
        //     console.log("PUTTING DOWN");
        //     await client.putdown();
        //   }
        // }
      }

      if (stat == false) {
        isMoving = false;
      }

      if (!isMoving) {
        //console.log("Next action: ", nextAction);
        src = nextAction.source;
        trg = nextAction.target;
        let move = Position.getDirectionTo(src, trg);

        if (!src.equals(rider.position)) {
          //plan = brain.createPlan();
          trg = null;
          continue;
        }

        // let blocked = false;
        // for (const a of blocking_agents.values()) {
        //   if (a.x == trg.x && a.y == trg.y) {
        //     trg = null;
        //     console.log("Agent in the way. Recalculating plan");
        //     rider.plan_fit = 0;
        //     newPlan();
        //     break;
        //   }
        // }

        // if (blocked) {
        //   continue;
        // }

        //console.log("elapsed: ", Date.now() - start);
        while (Date.now() - start < rider.config.MOVEMENT_DURATION) {
          await new Promise((res) => setImmediate(res));
        }
        start = Date.now();

        switch (nextAction.type) {
          case ActionType.MOVE:
            if (move != "none") {
              var stat = await client.move(move);
            }

            isMoving = true;
            break;
          case ActionType.PICKUP:
            await client.pickup();

            try {
              rider.parcels.set(
                nextAction.bestParcel,
                parcels.get(nextAction.bestParcel).reward
              );
              parcels.delete(nextAction.bestParcel);
            } catch (error) {
              console.error(
                "Parcel either expired or was deleted while executing plan."
              );
            }
            console.log("PICKING UP ", nextAction.bestParcel);
            break;
          case ActionType.PUTDOWN:
            console.log("PUTTING DOWN");
            await client.putdown();
            rider.parcels.clear();
            rider.plan_fit = 0;
            newPlan();
            break;
        }
      }
    } else {
      console.log("Plan is empty. Recalculating plan");
      rider.plan_fit = 0;
      newPlan();
    }
    await new Promise((res) => setImmediate(res));
  }
}

loop();
