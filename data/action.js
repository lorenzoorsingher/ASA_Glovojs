import { Position } from "./position.js";

export const ActionType = Object.freeze({
  MOVE : "move",
  PICKUP : "pick_up",
  PUTDOWN : "put_down",
  WAIT : "wait"
});

export class Action {
  constructor(source, target, type) {
    this.source = source;
    this.target = target;
    this.type = type;
  }

  static pathToAction(path, type) {
    const actions = [];
    const lastPosition = new Position();
    for (let i = 0; i < path.length - 1; i++) {
      const current = Position.deserialize(path[i]);
      const next = Position.deserialize(path[i + 1]);
      if (current.x === next.x) {
          if (current.y < next.y) {
              actions.push(new Action(current, next, ActionType.MOVE));
          } else {
              actions.push(new Action(current, next, ActionType.MOVE));
          }
      } else {
          if (current.x < next.x) {
              actions.push(new Action(current, next, ActionType.MOVE));
          } else {
              actions.push(new Action(current, next, ActionType.MOVE));
          }
      }
      lastPosition.x = next.x;
      lastPosition.y = next.y;
    }
    type === ActionType.PICKUP ? actions.push(new Action(lastPosition, lastPosition, ActionType.PICKUP)) : actions.push(new Action(lastPosition, lastPosition, ActionType.PUTDOWN));
    for (let action of actions) {
      action.printAction(true);
    }
    return actions;
  }

  printAction(opt) {
    console.log(this.type, " from ", this.source, " to ", this.target);
  }
}