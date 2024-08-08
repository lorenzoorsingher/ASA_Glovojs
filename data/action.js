import { Position } from "./position.js";

export const ActionType = Object.freeze({
  MOVE: "🔀 move",
  PICKUP: "🟡 pick_up",
  PUTDOWN: "🟢 put_down",
  WAIT: "wait",
});

export class Action {
  constructor(source, target, type, bestParcel) {
    this.source = source;
    this.target = target;
    this.type = type;
    this.bestParcel = bestParcel;
  }

  static pathToAction(path, type, bestParcel) {
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
            actions.push(new Action(current, next, ActionType.MOVE, null));
          } else {
            actions.push(new Action(current, next, ActionType.MOVE, null));
          }
        } else {
          if (current.x < next.x) {
            actions.push(new Action(current, next, ActionType.MOVE, null));
          } else {
            actions.push(new Action(current, next, ActionType.MOVE, null));
          }
        }
        lastPosition.x = next.x;
        lastPosition.y = next.y;
      }
    }

    if (type === ActionType.PICKUP) {
      actions.push(
        new Action(lastPosition, lastPosition, ActionType.PICKUP, bestParcel)
      );
    } else if (type === ActionType.PUTDOWN) {
      actions.push(
        new Action(lastPosition, lastPosition, ActionType.PUTDOWN, null)
      );
    } else {
      actions.push(
        new Action(lastPosition, lastPosition, ActionType.MOVE, null)
      );
    }

    // for (let action of actions) {
    //   action.printAction();
    // }
    return actions;
  }

  printAction() {
    if (this.bestParcel != null) {
      console.log(
        "\t",
        this.type,
        " from ",
        this.source,
        " to ",
        this.target,
        " -> ",
        this.bestParcel
      );
    } else {
      console.log("\t", this.type, " from ", this.source, " to ", this.target);
    }
  }
}
