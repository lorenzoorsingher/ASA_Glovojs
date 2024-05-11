import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import { Field } from "./data/field.js";
import { Position } from "./data/position.js";
import { Reasoning_1 } from "./brain.js";
import { TSP } from "./tspBrain.js";

import myServer from "./server.js";
import { Action, ActionType } from "./data/action.js";
import e from "express";

// myServer.start();
// myServer.serveDashboard();
export const VERBOSE = false;
const LOCAL = true;
const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhYmM4ZTE4ZjY2IiwibmFtZSI6ImxvbGxvIiwiaWF0IjoxNzE1MDkyODQ5fQ.PqPFemZ93idl9DKzOCMXDe0FaB9mgB0WWeVnA9j_Sao";

let client = null;

if (LOCAL) {
  client = new DeliverooApi(
    "http://localhost:8080/",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijg2OTFmNjUzMjJjIiwibmFtZSI6ImNpYW8iLCJpYXQiOjE3MTUwMjQ0MTF9.8L79LEzZejQAcKjuWEa_OMKfeChXnVcwn1sY-q2eCu8"
  );
} else {
  client = new DeliverooApi(
    "http://rtibdi.disi.unitn.it:8080",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE5OWFmMGQ2YmJkIiwibmFtZSI6Imdsb3ZvIiwiaWF0IjoxNzE1MTU3OTkwfQ.st5vWWHKQmXyX2Sb4r6TtkUXdO0ZJJDHxu2XZHpxENE"
  );
}

const me = {};
const map = new Field();
const brain = new TSP();

const parcels = new Map();
const agents = new Map();
const blocking_agents = new Map();

// contains the current plan
let plan = [];
// contains weather the plan is to a random tile or to a parcel
let plan_target = "RANDOM";
// hold loop until the map is loaded
let wait_load = true;

// player position
let playerPosition = new Position(0, 0);
// parcels carried by the player
let playerParcels = new Map();

// note that this happens before the onYou event
client.onMap((width, height, tiles) => {
  VERBOSE && console.log("Map received. Initializing...");
  // runMapTest()
  map.init(width, height, tiles, blocking_agents);
  brain.init(map, parcels, playerPosition);
});

client.onYou(({ id, name, x, y, score }) => {
  me.id = id;
  me.name = name;
  me.x = x;
  me.y = y;
  playerPosition = new Position(x, y);
  if (hasCompletedMovement(playerPosition)) {
    brain && brain.updatePlayerPosition(playerPosition);
    VERBOSE && console.log("Agent moved to: ", x, y);
    wait_load = false;
    //plan = brain.createPlan();
  }
});

client.onParcelsSensing(async (perceived_parcels) => {
  map.set_parcels(perceived_parcels);

  for (const p of perceived_parcels) {
    if (
      !parcels.has(p.id) &&
      hasCompletedMovement(playerPosition) &&
      p.carriedBy == null
    ) {
      parcels.set(p.id, p);
      // plan = brain.createPlan();
      // plan_target = "TILE";
    }
  }
});

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

client.onAgentsSensing(async (perceived_agents) => {
  agents.clear();
  blocking_agents.clear();
  for (const a of perceived_agents) {
    if (distance(playerPosition, a) < 2) {
      blocking_agents.set(a.id, a);
    } else {
      agents.set(a.id, a);
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
}, 1000);

// DASHBOARD UPDATE
setInterval(() => {
  let update_map = map.getMap();
  let plan_move = [];
  let plan_pickup = [];
  let plan_drop = [];

  let agent_parcels = [];

  let adv_agents = [];
  let blk_agents = [];
  if (plan.length > 0) {
    for (const p of plan) {
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
  for (const [key, p] of playerParcels.entries()) {
    car += key + " ";
  }
  let dash_data = {
    map_size: [map.width, map.height],
    tiles: update_map,
    agent: [me.x, me.y],
    plan: [plan_move, plan_pickup, plan_drop, plan_target],
    parc: agent_parcels,
    carrying: car,
    agents: adv_agents,
    blk_agents: blk_agents,
  };
  myServer.emitMessage("map", dash_data);
}, 100);

function hasCompletedMovement(pos) {
  return pos.x % 1 === 0.0 && pos.y % 1 === 0.0;
}

let nextAction = null;
let isMoving = false;
let trg = null;
let src = null;

let initial = true;

async function loop() {
  while (true) {
    if (wait_load) {
      await new Promise((res) => setTimeout(res, 300));
      continue;
    }
    plan = brain.createPlan();
    // if (plan.length > 0) {
    //   if (trg == null) {
    //     trg = playerPosition;
    //   }

    //   if (trg && trg.equals(playerPosition)) {
    //     initial = false;
    //     isMoving = false;
    //     nextAction = plan.shift();
    //   }
    //   if (stat == false) {
    //     isMoving = false;
    //   }

    //   if (!isMoving) {
    //     src = nextAction.source;
    //     trg = nextAction.target;
    //     let move = Position.getDirectionTo(src, trg);

    //     if (!src.equals(playerPosition)) {
    //       plan = brain.createPlan();
    //       trg = null;
    //       continue;
    //     }

    //     let blocked = false;
    //     for (const a of blocking_agents.values()) {
    //       if (a.x == trg.x && a.y == trg.y) {
    //         console.log("Agent in the way. Recalculating plan");
    //         let start = map.getTile(playerPosition);
    //         let end = map.getTile(plan[plan.length - 1].target);

    //         if (a.x == end.position.x && a.y == end.position.y) {
    //           console.log("Agent is blocking the target. Recalculating plan");
    //           end = map.getRandomWalkableTile();
    //           plan_target = "RANDOM";
    //         }
    //         let path = map.bfs(end, start);
    //         plan = Action.pathToAction(path);
    //         trg = null;
    //         blocked = true;
    //         break;
    //       }
    //     }
    //     if (blocked) {
    //       continue;
    //     }

    //     switch (nextAction.type) {
    //       case ActionType.MOVE:
    //         var stat = await client.move(move);

    //         isMoving = true;

    //         break;
    //       case ActionType.PICKUP:
    //         console.log("PICKING UP");
    //         await client.pickup();

    //         playerParcels.set(nextAction.bestParcel.id, true);
    //         parcels.delete(nextAction.bestParcel.id);
    //         brain.updateParcelsQueue();
    //         break;
    //       case ActionType.PUTDOWN:
    //         console.log("PUTTING DOWN");
    //         await client.putdown();
    //         playerParcels.clear();
    //         break;
    //     }
    //   }
    // } else {
    //   console.log("No plan found. Generating random plan");
    //   plan_target = "RANDOM";
    //   let start = map.getTile(playerPosition);
    //   let end = map.getRandomWalkableTile();
    //   let path = map.bfs(end, start);

    //   plan = Action.pathToAction(path);
    // }
    await new Promise((res) => setImmediate(res));
  }
}

loop();
