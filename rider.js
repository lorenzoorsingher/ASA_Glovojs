import { Position } from "./data/position.js";
import { Action, ActionType } from "./data/action.js";

export class Rider {
  constructor() {
    this.player_parcels = new Map();
    this.plan = [];
    this.scorepla = 0;
    this.config = {};
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
    console.log("Config received: ", this.config);
  }

  updatePosition(x, y) {
    this.position.x = x;
    this.position.y = y;
  }
}
