export const Direction = Object.freeze({
  UP: "up",
  DOWN: "down",
  LEFT: "left",
  RIGHT: "right",
  NONE: "none",
});

export class Position {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  moveTo(direction) {
    switch (direction) {
      case Direction.UP:
        return new Position(this.x, this.y + 1);
      case Direction.DOWN:
        return new Position(this.x, this.y - 1);
      case Direction.LEFT:
        return new Position(this.x - 1, this.y);
      case Direction.RIGHT:
        return new Position(this.x + 1, this.y);
      case Direction.NONE:
        return new Position(this.x, this.y);
      default:
        throw new Error(`err: ${direction}`);
    }
  }

  static getDirectionTo(source, target) {
    if (source.x < target.x) {
      return Direction.RIGHT;
    } else if (source.x > target.x) {
      return Direction.LEFT;
    } else if (source.y < target.y) {
      return Direction.UP;
    } else if (source.y > target.y) {
      return Direction.DOWN;
    } else {
      return Direction.NONE;
    }
  }

  equals(other) {
    return this.x === other.x && this.y === other.y;
  }

  serialize() {
    return `${this.x}-${this.y}`;
  }

  static deserialize(str) {
    const [x, y] = str.split("-");
    return new Position(Number(x), Number(y));
  }
}
