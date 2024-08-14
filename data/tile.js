import { Position, Direction } from "./position.js";

export class Tile {
  constructor(position, walk, delivery) {
    this.position = position;
    this.walkable = walk;
    this.hasAgent = false;
    this.delivery = delivery;
    this.id = Position.serialize(this.position);
    this.neighbors = [];

    this.parcel = -1;
  }

  getX() {
    return this.position.x;
  }

  getY() {
    return this.position.y;
  }

  setNeighbors(neigh) {
    this.neighbors = neigh;
  }

  setAgent(bool) {
    this.hasAgent = bool;
  }

  getNeighbors() {
    return this.neighbors;
  }
}
