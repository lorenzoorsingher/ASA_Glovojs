import { Position } from "./data/position.js";
import { Action, ActionType } from "./data/action.js";

export class Rider {
  init(id, name, score, position) {
    this.parcels = new Map();
    this.id = id;
    this.name = name;
    this.score = score;
    this.position = position;
    // this.plan = this.createPlan(parcelsQueue)
  }

  updatePosition(x, y) {
    this.position.x = x;
    this.position.y = y;
  }
}
