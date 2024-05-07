import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import { Field } from "./data/field.js";
import { Position } from "./data/position.js";
import { Reasoning_1 } from "./brain.js";

import myServer from "./server.js";
import { Action, ActionType } from "./data/action.js";

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
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE4OTMwMGVhOTE0IiwibmFtZSI6ImhlbG8iLCJpYXQiOjE3MTE0NTExNzF9.MaEAYnfg0Vr9iAcFrW5kUJ8QBY_f2GMzPHB6V8brLCI"
  );
} else {
  client = new DeliverooApi("http://cuwu.ddns.net:8082", TOKEN);
}

const me = {};
const map = new Field();
const brain = new Reasoning_1();

const parcels2 = new Map();

let plan = [];
let plan_target = "RANDOM";
let wait_load = true;

let playerPosition = new Position(0, 0);
let playerParcels = new Map();

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
  }

  //console.log("p ", parcels.entries());
});

// note that this happens before the onYou event
client.onMap((width, height, tiles) => {
  VERBOSE && console.log("Map received. Initializing...");
  // runMapTest()
  map.init(width, height, tiles);
  brain.init(map, parcels2, playerPosition);
});

const activeIntervals = new Set();

client.onParcelsSensing(async (perceived_parcels) => {
  map.set_parcels(perceived_parcels);

  for (const p of perceived_parcels) {
    if (
      !parcels.has(p.id) &&
      hasCompletedMovement(playerPosition) &&
      p.carriedBy == null
    ) {
      parcels2.set(p.id, p);
      plan = brain.updateParcelsQueue();
      plan_target = "TILE";
    }
  }
});

// PARCELS CLOCK
setInterval(() => {
  for (const [key, value] of parcels2.entries()) {
    value.reward--;
    if (value.reward <= 0) {
      parcels2.delete(key);
    } else {
      parcels2.set(key, value);
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

  for (const [key, p] of parcels2.entries()) {
    agent_parcels.push({ x: p.x, y: p.y, reward: p.reward });
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
    if (plan.length > 0) {
      if (trg == null) {
        trg = playerPosition;
      }

      if (trg && trg.equals(playerPosition)) {
        initial = false;
        isMoving = false;
        nextAction = plan.shift();
      }
      if (stat == false) {
        isMoving = false;
      }

      if (!isMoving) {
        src = nextAction.source;
        trg = nextAction.target;
        let move = Position.getDirectionTo(src, trg);

        if (!src.equals(playerPosition)) {
          plan = brain.createPlan();
          trg = null;
          continue;
        }

        switch (nextAction.type) {
          case ActionType.MOVE:
            var stat = await client.move(move);

            isMoving = true;

            break;
          case ActionType.PICKUP:
            console.log("PICKING UP");
            await client.pickup();

            playerParcels.set(nextAction.bestParcel.id, true);
            parcels2.delete(nextAction.bestParcel.id);
            brain.updateParcelsQueue();

            nextAction = null;

            break;
          case ActionType.PUTDOWN:
            console.log("PUTTING DOWN");
            playerParcels = new Map();
            await client.putdown();
            nextAction = null;
            break;
        }
      }
    } else {
      console.log("No plan found. Generating random plan");
      plan_target = "RANDOM";
      let start = map.getTile(playerPosition);
      let end = map.getRandomWalkableTile();
      let path = map.bfs(end, start);

      plan = Action.pathToAction(path);
    }
    await new Promise((res) => setImmediate(res));
  }
}

loop();
