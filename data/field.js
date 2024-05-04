import { Tile } from "./tile.js";
import { Position, Direction } from "./position.js";

export class Field {
  init(width, height, tiles) {
    this.width = width;
    this.height = height;
    this.field = [];

    this.parcels = new Map();

    for (let i = 0; i < height; i++) {
      this.field[i] = [];
      for (let j = 0; j < width; j++) {
        let found = false;
        let delivery = false;
        for (const t of tiles) {
          if (t.x == j && t.y == i) {
            found = true;
            delivery = t.delivery;
            break;
          }
        }
        let pos = new Position(j, i);
        this.field[i][j] = new Tile(pos, found, delivery);
      }
    }

    //load neighbors
    for (let i = 0; i < this.height; i++) {
      for (let j = 0; j < this.width; j++) {
        if (this.field[i][j].walkable) {
          this.field[i][j].set_neighbors(this.neighbors(new Position(j, i)));
        }
      }
    }
  }

  set_parcels(perceived_parcels) {
    this.update_map();
    for (const p of perceived_parcels) {
      if (p.carriedBy == null) {
        this.field[p.y][p.x].set_parcel(p.reward);
        //console.log(this.field[p.y][p.x]);
      }
    }
  }

  update_map() {
    for (let i = 0; i < this.height; i++) {
      for (let j = 0; j < this.width; j++) {
        this.field[i][j].parcel = -1;
      }
    }
  }

  getMap() {
    let tiles = [];
    for (let i = 0; i < this.height; i++) {
      tiles[i] = [];
      for (let j = 0; j < this.width; j++) {
        let cell = { type: "X", parcel: -1 };
        if (this.field[i][j].walkable) {
          cell["type"] = "W";
        }
        if (this.field[i][j].delivery) {
          cell["type"] = "D";
        }
        cell["parcel"] = this.field[i][j].parcel;
        tiles[i][j] = cell;
      }
    }

    return tiles;
  }

  getTile(pos) {
    return this.field[pos.y][pos.x];
  }

  printMap() {
    for (let i = 0; i < this.height; i++) {
      let row = "";
      for (let j = 0; j < this.width; j++) {
        if (this.field[i][j].walkable) {
          row += "O ";
        } else {
          row += "  ";
        }
      }
      console.log(row);
    }
  }

  printPath(start, end, path) {
    let s = "   ";
    for (let i = 1; i <= this.width; i += 1) {
      s += i - 1 + " ".repeat(2 - i / 10);
    }
    console.log(s);

    for (let i = 0; i < this.height; i++) {
      let row = i + " " + " ".repeat(2 - (i + 1) / 10);
      for (let j = 0; j < this.width; j++) {
        if (i == start.y && j == start.x) {
          row += "S ";
        } else if (i == end.y && j == end.x) {
          row += "E ";
        } else if (path.includes(this.field[i][j].id)) {
          row += "X ";
        } else if (this.field[i][j].walkable) {
          row += "O ";
        } else {
          row += "  ";
        }
      }
      console.log(row);
    }
  }

  neighbors(pos) {
    let x = pos.x;
    let y = pos.y;
    const neighbors = [];
    if (x > 0 && this.field[y][x - 1].walkable) {
      neighbors.push({ x: x - 1, y });
    }
    if (x < this.width - 1 && this.field[y][x + 1].walkable) {
      neighbors.push({ x: x + 1, y });
    }
    if (y > 0 && this.field[y - 1][x].walkable) {
      neighbors.push({ x, y: y - 1 });
    }
    if (y < this.height - 1 && this.field[y + 1][x].walkable) {
      neighbors.push({ x, y: y + 1 });
    }
    return neighbors;
  }

  bfs(start, end) {
    const par = {};
    const queue = [];
    const distance = {};

    distance[start.id] = 0;
    queue.push(this.getTile(start.position));
    while (queue.length > 0) {
      const node = queue.shift();
      for (const n of node.neighbors) {
        //console.log(node.neighbors);
        const n_tile = this.getTile(n);
        if (distance[n_tile.id] == undefined) {
          par[n_tile.id] = node;
          distance[n_tile.id] = distance[node.id] + 1;
          queue.push(n_tile);
        }
      }
    }
    //console.log(distance[end.id]);

    const path = [];
    let currentNode = end.id;
    path.push(end.id);
    while (par[currentNode] !== undefined) {
      path.push(par[currentNode].id);
      currentNode = par[currentNode].id;
    }

    return path;
  }
}
