import { Position } from "./position.js";

export const ActionType = Object.freeze({
  MOVE: "🔀 move",
  PICKUP: "🟡 pick_up",
  PUTDOWN: "🟢 put_down",
  WAIT: "wait",
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

    if (path.length == 1) {
      lastPosition.x = Position.deserialize(path[0]).x;
      lastPosition.y = Position.deserialize(path[0]).y;
    } else {
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
    }

    if (type === ActionType.PICKUP) {
      // if (!lastPosition) {
      //   console.log("lastPosition is null");
      //   console.log(lastPosition);
      // } else {
      //   console.log("lastPosition is not null");
      //   console.log(lastPosition);
      // }
      actions.push(new Action(lastPosition, lastPosition, ActionType.PICKUP));
    } else {
      actions.push(new Action(lastPosition, lastPosition, ActionType.PUTDOWN));
    }

    for (let action of actions) {
      action.printAction(true);
    }
    return actions;
  }

  printAction(opt) {
    console.log("\t", this.type, " from ", this.source, " to ", this.target);
  }
}
