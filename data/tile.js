import { Position, Direction } from "./position.js";

export class Tile {
  constructor(position, walk, delivery) {
    this.position = position;
    this.walkable = walk;
    this.delivery = delivery;
    this.id = position.serialize();
    this.neighbors = [];
  }

  get_x() {
    return this.position.x;
  }

  get_y() {
    return this.position.y;
  }

  set_neighbors(neigh) {
    this.neighbors = neigh;
  }
}
