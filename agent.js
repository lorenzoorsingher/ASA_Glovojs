import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import { Field } from "./data/field.js";
import { Position } from "./data/position.js";
import { Reasoning_1 } from "./brain.js";

import myServer from "./server.js";
import { Action, ActionType } from "./data/action.js";

// myServer.start();
// myServer.serveDashboard();

const client = new DeliverooApi(
  "http://localhost:8080/",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijg2OTFmNjUzMjJjIiwibmFtZSI6ImNpYW8iLCJpYXQiOjE3MTUwMjQ0MTF9.8L79LEzZejQAcKjuWEa_OMKfeChXnVcwn1sY-q2eCu8"
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
  // if (brain && parcels.size === 0) {
  //   brain.createPlan(
  //     map.bfs(map.getTile(playerPosition), map.getRandomWalkableTile())
  //   );
  //}
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

  for (const p of perceived_parcels) {
    if (!parcels.has(p.id)) {
      console.log(
        "New parcel found at x: ",
        p.x,
        "y:",
        p.y,
        "id:",
        p.id,
        "reward:",
        p.reward
      );
      parcels.set(p.id, p);
      plan = brain.updateParcelsQueue();
      //console.log("Plan updated: ", plan);
      startParcelTimer(p.id);
    }
  }
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
          brain.updateParcelsQueue();
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
    plan_s.push(plan[0].source.serialize());
    for (const p of plan) {
      plan_s.push(p.target.serialize());
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

// function fakePlan() {
//   console.log("Creating fake plan...");
//   let start = map.getTile(playerPosition);

//   let end = map.getTile(map.getRandWalkableTile());
//   let path = map.bfs(end, start);

//   let plan = Action.pathToAction(path);

//   console.log("starting position: ", start);
//   console.log("ending position: ", end);
//   console.log("plan: ", plan);

//   return plan;
// }

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
        //console.log("NEXT ACTION: ", nextAction);
      }

      let src = nextAction.source;
      let trg = nextAction.target;
      let move = Position.getDirectionTo(src, trg);
      console.log(nextAction, " ", move);

      // console.log(trg, " ", playerPosition);

      switch (nextAction.type) {
        case ActionType.MOVE:
          let stat = await client.move(move);
          if (trg.equals(new Position(stat.x, stat.y))) {
            nextAction = null;
          } else if (stat == false) {
            console.log("REPLAN");
            //plan = fakePlan();
            nextAction = null;
          }
          break;
        case ActionType.PICKUP:
          await client.pickup();
          nextAction = null;
          break;
        case ActionType.PUTDOWN:
          await client.putdown();
          nextAction = null;
          break;
      }
    } else {
      // brain.createPlan(
      //   map.bfs(map.getTile(playerPosition), map.getRandomWalkableTile())
      // );
    }
    await new Promise((res) => setImmediate(res));
  }
}

loop();
