import { Position } from "./data/position.js";
import { Action, ActionType } from "./data/action.js";
import { Genetic } from "./master_geneticBrain.js";
import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";

export class Rider {
  constructor(uname) {
    this.carrying = 0;
    this.plan = [];
    this.plan_fit = 0;
    this.no_delivery = 0;
    this.config = {};

    this.uname = uname;
    this.player_init = false;

    this.player_parcels = new Map();
    this.blocking_agents = new Map();

    //this.brain = new Genetic(this.blocking_agents);
    this.client = new DeliverooApi(
      "http://localhost:8080/?name=" + this.uname,
      ""
    );

    console.log("Rider created");
  }

  init(id, name, score, position, brain) {
    this.id = id;
    this.name = name;
    this.score = score;
    this.position = position;
    this.src = new Position(position.x, position.y);
    this.trg = new Position(position.x, position.y);
    this.nextAction = null;
    this.brain = brain;
    // this.plan = this.createPlan(parcelsQueue)
  }

  set_config(config) {
    this.config = config;
    console.log("Config received: ", this.config);
  }

  updatePosition(x, y) {
    this.position.x = x;
    this.position.y = y;
  }

  // newPlan() {
  //   // console.log("MyPos: ", rider.position);
  //   this.planLock = true;
  //   const [tmp_plan, best_fit] = this.brain.createPlan(this.player_parcels);

  //   // console.log("Best fit: ", best_fit);
  //   if (best_fit > this.plan_fit) {
  //     this.plan_fit = best_fit;
  //     this.plan = tmp_plan;
  //     this.trg = this.position;
  //     console.log("New plan accepted by ", this.uname);
  //   } else {
  //     console.log("New plan rejected by ", this.uname);
  //   }
  //   this.planLock = false;
  // }

  isPathBlocked() {
    let blocked = false;
    for (const a of this.blocking_agents.values()) {
      if (a.x == this.trg.x && a.y == this.trg.y) {
        blocked = true;
        break;
      }
    }
    return blocked;
  }
}
