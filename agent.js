import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import { Field } from "./data/field.js";
import { Position } from "./data/position.js";
import { Reasoning_1 } from "./brain.js";

import myServer from "./server.js";

// myServer.start();
// myServer.serveDashboard();

const client = new DeliverooApi(
  "http://cuwu.ddns.net:8082/",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjQ0ZjMyZGM5NDZjIiwibmFtZSI6ImxvbG8iLCJpYXQiOjE3MTQ5OTkxMTh9.C78PWNGJ7u9vQaMyy3paNF-L-W-IPLDCHIDAbm-8vvk"
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

let playerPosition = new Position(0, 0);
client.onYou(({ id, name, x, y, score }) => {
  me.id = id;
  me.name = name;
  me.x = x;
  me.y = y;
  playerPosition = new Position(x, y);
  brain && brain.updatePlayerPosition(playerPosition);
  VERBOSE && console.log("Agent moved to: ", x, y);
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
      brain && brain.addParcelandOrder(p.id);
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
  let dash_data = {
    map_size: [map.width, map.height],
    tiles: update_map,
    agent: [me.x, me.y],
  };

  myServer.emitMessage("map", dash_data);
}, 100);
