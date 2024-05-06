import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import { Field } from "./data/field.js";
import { Position } from "./data/position.js";
import { Reasoning_1 } from "./brain.js";

const client = new DeliverooApi(
  "http://localhost:8080",
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

let playerPosition = new Position(0, 0);
client.onYou(({ id, name, x, y, score }) => {
  me.id = id;
  me.name = name;
  me.x = x;
  me.y = y;
  playerPosition = new Position(x, y);
  brain && brain.updatePlayerPosition(playerPosition);
  VERBOSE && console.log("Agent moved to: ", x, y);
  if(brain && parcels.size === 0) {
    brain.createPlan(map.bfs(map.getTile(playerPosition), map.getRandomWalkableTile()));
  }
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

  if(VERBOSE) {
    map.printPath(start, end, path);
    console.log(path);
  }
}

const activeIntervals = new Set();

client.onParcelsSensing(async (perceived_parcels) => {
  for (const p of perceived_parcels) {
    if (!parcels.has(p.id)) {
      console.log("New parcel found at x: ", p.x, "y:", p.y, "id:", p.id, "reward:", p.reward);
      parcels.set(p.id, p);
      brain.updateParcelsQueue();
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

function select(options) {
  for (const option of options) {
    if (option.intention == "pick up parcel" && picked_up.length == 0)
      return option;
  }
}

function astar({ x, y }, agent) {}

/**
 * Beliefset revision loop
 */

// function agentLoop() {
//   // belief_revision_function()
//   // const options = options() // desire pick up parcel p1 or p2
//   // const selected = select(options) // p1 is closer!
//   // intention_queue.push( [ selected.intention, selected.args ] );
// }
// client.onParcelsSensing(agentLoop);
// client.onAgentsSensing(agentLoop);
// client.onYou(agentLoop);

/**
 * Intention execution loop
 */
class Agent {
  intention_queue = new Array();

  async intentionLoop() {
    while (true) {
      const intention = this.intention_queue.shift();
      if (intention) await intention.achieve();
      await new Promise((res) => setImmediate(res));
    }
  }

  async queue(desire, ...args) {
    const last = this.intention_queue.at(this.intention_queue.length - 1);
    const current = new Intention(desire, ...args);
    this.intention_queue.push(current);
  }

  async stop() {
    console.log("stop agent queued intentions");
    for (const intention of this.intention_queue) {
      intention.stop();
    }
  }
}

/**
 * Intention
 */
class Intention extends Promise {
  #current_plan;
  stop() {
    console.log("stop intention and current plan");
    this.#current_plan.stop();
  }

  #desire;
  #args;

  #resolve;
  #reject;

  constructor(desire, ...args) {
    var resolve, reject;
    super(async (res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.#resolve = resolve;
    this.#reject = reject;
    this.#desire = desire;
    this.#args = args;
  }

  #started = false;
  async achieve() {
    if (this.#started) return this;
    else this.#started = true;

    for (const plan of plans) {
      if (plan.isApplicableTo(this.#desire)) {
        this.#current_plan = plan;
        console.log(
          "achieving desire",
          this.#desire,
          ...this.#args,
          "with plan",
          plan
        );
        try {
          const plan_res = await plan.execute(...this.#args);
          this.#resolve(plan_res);
          console.log(
            "plan",
            plan,
            "succesfully achieved intention",
            this.#desire,
            ...this.#args,
            "with result",
            plan_res
          );
          return plan_res;
        } catch (error) {
          console.log(
            "plan",
            plan,
            "failed while trying to achieve intention",
            this.#desire,
            ...this.#args,
            "with error",
            error
          );
        }
      }
    }

    this.#reject();
    console.log("no plan satisfied the desire ", this.#desire, ...this.#args);
    throw "no plan satisfied the desire " + this.#desire;
  }
}

/**
 * Plan library
 */
const plans = [];

class Plan {
  stop() {
    console.log("stop plan and all sub intentions");
    for (const i of this.#sub_intentions) {
      i.stop();
    }
  }

  #sub_intentions = [];

  async subIntention(desire, ...args) {
    const sub_intention = new Intention(desire, ...args);
    this.#sub_intentions.push(sub_intention);
    return await sub_intention.achieve();
  }
}

class GoPickUp extends Plan {
  isApplicableTo(desire) {
    return desire == "go_pick_up";
  }

  async execute({ x, y }) {
    await this.subIntention("go_to", { x, y });
    await client.pickup();
  }
}

class BlindMove extends Plan {
  isApplicableTo(desire) {
    return desire == "go_to";
  }

  async execute({ x, y }) {
    while (me.x != x || me.y != y) {
      //console.log("I wanna go ", { x, y });
    }
  }
}

plans.push(new GoPickUp());
plans.push(new BlindMove());

const myAgent = new Agent();
myAgent.intentionLoop();
// client.onYou( () => myAgent.queue( 'go_to', {x:11, y:6} ) )

// client.onParcelsSensing((parcels) => {
//   for (const { x, y, carriedBy } of parcels) {
//     if (!carriedBy) myAgent.queue("go_pick_up", { x, y });
//   }
// });
