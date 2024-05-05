export const ActionType = Object.freeze({
  MOVE : "move",
  PICKUP : "left",
  PUTDOWN : "put down",
  WAIT : "wait"
});

export class Action {
  constructor(source, target, type) {
    this.source = source;
    this.target = target;
    this.type = type;
  }

  printAction(opt) {
    if(opt == true) {
      console.log(this.type, " from ", this.source, " to ", this.target);
    }
  }
}