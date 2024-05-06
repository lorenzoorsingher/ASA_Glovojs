import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import { Field } from "./data/field.js";
import { Position } from "./data/position.js";
import { Reasoning_1 } from "./brain.js";

import myServer from "./server.js";
import { Action } from "./data/action.js";

// myServer.start();
// myServer.serveDashboard();

const client = new DeliverooApi(
  "http://localhost:8080/",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjA0ODQzNzkwZWVhIiwibmFtZSI6ImNpYW8iLCJpYXQiOjE3MTI2NTcwMjh9.Kyuu4Gx3Volxzl-ygypFmEQYHaDaVz2liYo8T7-o0-I"
);

export const VERBOSE = false;

const me = {};
const map = new Field();
const brain = new Reasoning_1();
const parcels = new Map();

function distance({ x: x1, y: y1 }, { x: x2, y: y2 }) {
  const dx = Math.abs(Math.round(x1) - Math.round(x2));
  const dy = Math.abs(Math.round(y1) - Math.round(y2));
  return dx + dy;
}

let plan = [];
let wait_load = true;

let playerPosition = new Position(0, 0);
client.onYou(({ id, name, x, y, score }) => {
  me.id = id;
  me.name = name;
  me.x = x;
  me.y = y;
  playerPosition = new Position(Math.round(x), Math.round(y));
  //playerPosition = new Position(x, y);
  brain && brain.updatePlayerPosition(playerPosition);
  VERBOSE && console.log("Agent moved to: ", x, y);

  wait_load = false;
});

// note that this happens before the onYou event
client.onMap((width, height, tiles) => {
  VERBOSE && console.log("Map received. Initializing...");
  // runMapTest()
  map.init(width, height, tiles);
  brain.init(map, parcels, playerPosition);
});

function runMapTest() {
  let start = map.getTile(new Position(2, 2));
  let end = map.getTile(new Position(5, 4));
  let path = map.bfs(start, end);

  if (VERBOSE) {
    map.printPath(start, end, path);
    console.log(path);
  }
}

const activeIntervals = new Set();

client.onParcelsSensing(async (perceived_parcels) => {
  map.set_parcels(perceived_parcels);
  // for (const p of perceived_parcels) {
  //   if (!parcels.has(p.id)) {
  //     console.log(
  //       "New parcel found at x: ",
  //       p.x,
  //       "y:",
  //       p.y,
  //       "id:",
  //       p.id,
  //       "reward:",
  //       p.reward
  //     );
  //     parcels.set(p.id, p);
  //     brain && brain.addParcelandOrder(p.id);
  //     startParcelTimer(p.id);
  //   }
  // }
});

function startParcelTimer(id) {
  if (!activeIntervals.has(id)) {
    const intervalId = setInterval(() => {
      const parcel = parcels.get(id);
      if (parcel) {
        parcel.reward -= 1;
        if (parcel.reward < 0) {
          clearInterval(intervalId);
          parcels.delete(id);
          console.log("Parcel", id, "expired");
          // brain && brain.removeParcel(id);
          activeIntervals.delete(id);
        }
      } else {
        // If parcel data is not found (possibly removed already), clear the interval
        clearInterval(intervalId);
        activeIntervals.delete(id);
      }
    }, 1000);
    activeIntervals.add(id);
  }
}

console.log(
  "Creating brain with parcels",
  parcels,
  "and player position",
  playerPosition
);

function options() {
  const options = [];
  for (const parcel of parcels.values())
    options.push({ intention: "pick up parcel", args: [parcel] });
  for (const tile of tiles.values())
    if (tile.delivery) options.push({ intention: "deliver to", args: [tile] });
}

setInterval(() => {
  let update_map = map.getMap();

  let plan_s = [];
  if (plan.length > 0) {
    plan_s.push(plan[0].source);
    for (const p of plan) {
      plan_s.push(p.target);
    }
  }

  let dash_data = {
    map_size: [map.width, map.height],
    tiles: update_map,
    agent: [me.x, me.y],
    plan: plan_s,
  };
  myServer.emitMessage("map", dash_data);
}, 100);

function fakePlan() {
  console.log("Creating fake plan...");
  let start = map.getTile(playerPosition);

  let end = map.getTile(map.getRandWalkableTile());
  let path = map.bfs(end, start);

  let plan = Action.pathToAction(path);

  console.log("starting position: ", start);
  console.log("ending position: ", end);
  console.log("plan: ", plan);

  return plan;
}

// async function loop() {
//   while (true) {
//     console.log(fakeplan);
//   }
// while (true) {
//   console.log(fakeplan);
//   if (fakeplan.length > 0) {
//     for (let i = 0; i < fakeplan.length; i++) {
//       let action = fakeplan[i];
//       let src = Position.deserialize(action.source);
//       let trg = Position.deserialize(action.target);
//       console.log(action.source);
//       let move = Position.getDirectionTo(src, trg);
//       console.log(action, " ", move);
//     }
//     let action = plan.shift();
//     action.printAction(true);
//     client.sendAction(action);
//   }
// }
//}

let nextAction = null;
async function loop() {
  while (true) {
    if (wait_load) {
      await new Promise((res) => setTimeout(res, 300));
      continue;
    }
    if (plan.length > 0) {
      if (nextAction == null) {
        nextAction = plan.shift();
        console.log("NEXT ACTION: ", nextAction);
      }

      let src = Position.deserialize(nextAction.source);
      let trg = Position.deserialize(nextAction.target);
      let move = Position.getDirectionTo(src, trg);
      // console.log(nextAction, " ", move);

      // console.log(trg, " ", playerPosition);
      let stat = await client.move(move);
      if (trg.equals(new Position(stat.x, stat.y))) {
        nextAction = null;
      }
    } else {
      plan = fakePlan();
    }
    await new Promise((res) => setImmediate(res));
  }
}

loop();
