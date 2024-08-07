import { Position } from "./data/position.js";
import { Action, ActionType } from "./data/action.js";
import { Genetic } from "./multi_geneticBrain.js";
import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";

export class Rider {
  constructor(uname) {
    this.player_parcels = new Map();
    this.carrying = 0;
    this.plan = [];
    this.plan_fit = 0;
    this.config = {};

    this.uname = uname;
    this.player_init = false;

    this.src = null;
    this.trg = null;
    this.nextAction = null;
    this.planLock = false;

    this.brain = new Genetic();
    this.client = new DeliverooApi(
      "http://localhost:8080/?name=" + this.uname,
      ""
    );

    console.log("Rider created");
  }

  init(id, name, score, position, config) {
    this.parcels = new Map();
    this.id = id;
    this.name = name;
    this.score = score;
    this.position = position;
    this.config = {};
    // this.plan = this.createPlan(parcelsQueue)
  }

  set_config(config) {
    this.config = config;
    this.brain.set_config(config);
    console.log("Config received: ", this.config);
  }

  updatePosition(x, y) {
    this.position.x = x;
    this.position.y = y;
  }

  newPlan() {
    this.brain.updatePlayerPosition(this.trg, this.config.MOVEMENT_DURATION);
    // console.log("MyPos: ", rider.position);
    this.planLock = true;
    const [tmp_plan, best_fit] = this.brain.createPlan(this.parcels);

    // console.log("Best fit: ", best_fit);
    if (best_fit > this.plan_fit) {
      this.plan_fit = best_fit;
      this.plan = tmp_plan;
      this.trg = this.position;
      console.log("New plan accepted");
    } else {
      console.log("New plan rejected");
    }
    this.planLock = false;
  }
}
