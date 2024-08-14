import { Position, Direction } from "./position.js";

/**
 * Represents a tile in the field
 *
 * @param {Position} position position of the tile
 * @param {boolean} walk it's a walkable tile
 * @param {boolean} delivery it's a delivery zone
 *
 * @property {Position} position position of the tile
 * @property {boolean} walkable it's a walkable tile
 * @property {boolean} delivery it's a delivery zone
 * @property {string} id unique identifier
 * @property {Array} neighbors array of reachable neighbors
 *
 */
export class Tile {
  constructor(position, walk, delivery) {
    this.position = position;
    this.walkable = walk;
    this.delivery = delivery;
    this.id = Position.serialize(this.position);
    this.neighbors = [];
  }

  setNeighbors(neigh) {
    this.neighbors = neigh;
  }

  getNeighbors() {
    return this.neighbors;
  }
}
