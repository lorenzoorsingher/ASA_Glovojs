import { Position, Direction } from "./position.js";

export class Tile {
    constructor(position, walk, delivery) {
      this.walkable = walk;
      this.delivery = delivery;
      this.position = position;
      this.id = position.serialize();
      this.neighbors = this.set_neighbors();
    }

    get_x() {
      return this.position.x;
    }

    get_y() {
        return this.position.y;
    }

    set_neighbors() {
        let neighbors = [
            this.position.moveTo(Direction.LEFT),
            this.position.moveTo(Direction.RIGHT),
            this.position.moveTo(Direction.UP),
            this.position.moveTo(Direction.DOWN),
        ];
        this.neighbors = neighbors.filter(n => n !== null);
    }
  }