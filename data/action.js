export const ActionType = Object.freeze({
  MOVE: "move",
  PICKUP: "pick_up",
  PUTDOWN: "put_down",
  WAIT: "wait",
});

export class Action {
  constructor(source, target, type) {
    this.source = source;
    this.target = target;
    this.type = type;
  }

  static pathToAction(path) {
    const actions = [];
    for (let i = 0; i < path.length - 1; i++) {
      const current = path[i];
      const next = path[i + 1];
      if (current.x === next.x) {
        if (current.y < next.y) {
          actions.push(new Action(current, next, "MOVE"));
        } else {
          actions.push(new Action(current, next, "MOVE"));
        }
      } else {
        if (current.x < next.x) {
          actions.push(new Action(current, next, "MOVE"));
        } else {
          actions.push(new Action(current, next, "MOVE"));
        }
      }
    }
    return actions;
  }

  printAction(opt) {
    if (opt == true) {
      console.log(this.type, " from ", this.source, " to ", this.target);
    }
  }
}
