import { Position, Direction } from "./position.js";

export class Tile {
  constructor(position, walk, delivery) {
    this.position = position;
    this.walkable = walk;
    this.delivery = delivery;
    this.id = position.serialize();
    this.neighbors = [];

    this.parcel = -1;
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

  set_parcel(parcel_score) {
    this.parcel = parcel_score;
  }
}
