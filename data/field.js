import { Tile } from "./tile.js";
import { Position, Direction } from "./position.js";
import { VERBOSE } from "../agent.js";

export class Field {
  init(width, height, tiles, agents) {
    this.agents = agents;
    this.width = width;
    this.height = height;
    this.field = [];

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
    this.deliveryZones = this.getDeliveryZones();
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
      VERBOSE && console.log(row);
    }
  }

  printPath(start, end, path) {
    let s = "   ";
    for (let i = 1; i <= this.width; i += 1) {
      s += i - 1 + " ".repeat(2 - i / 10);
    }
    VERBOSE && console.log(s);

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
      VERBOSE && console.log(row);
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

    if (this.isTileUnreachable(start) || this.isTileUnreachable(end)) {
      console.log("BFS: Start or End tile is unreachable");
      return [];
    }

    let blocking = [];
    for (const a of this.agents.values()) {
      blocking.push(a.x + "-" + a.y);
    }

    distance[start.id] = 0;
    queue.push(this.getTile(start.position));
    while (queue.length > 0) {
      const node = queue.shift();
      for (const n of node.getNeighbors()) {
        if (!blocking.includes(n.x + "-" + n.y)) {
          VERBOSE && console.log(node.getNeighbors());
          const n_tile = this.getTile(n);
          if (distance[n_tile.id] == undefined) {
            par[n_tile.id] = node;
            distance[n_tile.id] = distance[node.id] + 1;
            queue.push(n_tile);
          }
        } else {
          VERBOSE &&
            console.log("Tile " + this.getTile(n).position + " is blocked");
        }
      }
    }
    VERBOSE && console.log(distance[end.id]);

    const path = [];
    let currentNode = end.id;
    path.push(end.id);
    while (par[currentNode] !== undefined) {
      path.push(par[currentNode].id);
      currentNode = par[currentNode].id;
    }
    VERBOSE &&
      console.log(
        "It takes ",
        path.length - 1,
        " steps to reach the destination"
      );
    return path;
  }

  getClosestDeliveryZone(pos) {
    const x = pos.x;
    const y = pos.y;

    let closest = null;
    let smallestDistance = Infinity;

    for (let d of this.deliveryZones) {
      const distance = this.bfs(this.getTile(d), this.getTile(pos)).length - 1;
      if (distance < smallestDistance) {
        smallestDistance = distance;
        closest = d;
      }
    }
    VERBOSE &&
      console.log("Closest delivery zone is at ", closest.x, closest.y);
    return this.getTile(closest);
  }

  getClosestDeliveryZones(pos) {
    const x = pos.x;
    const y = pos.y;

    let closest = [];

    for (let d of this.deliveryZones) {
      const distance = this.bfs(this.getTile(d), this.getTile(pos)).length - 1;
      closest.push({ x: d.x, y: d.y, distance: distance });
    }

    closest = this.sort_by_key(closest, "distance");

    return closest;
  }

  sort_by_key(array, key) {
    return array.sort(function (a, b) {
      var x = a[key];
      var y = b[key];
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }
  getDeliveryZones() {
    const positions = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.field[y][x].delivery) {
          positions.push(new Position(x, y));
          VERBOSE && console.log("Found delivery zone at ", x, y);
        }
      }
    }
    return positions;
  }

  getRandomWalkableTile() {
    let x, y;
    let tile;

    do {
      x = Math.floor(Math.random() * this.width);
      y = Math.floor(Math.random() * this.height);
      tile = this.getTile(new Position(x, y));
    } while (!tile.walkable || this.isTileUnreachable(tile));

    return tile;
  }

  isDeliveryZone(pos) {
    return this.field[pos.y][pos.x].delivery;
  }

  isTileUnreachable(tile) {
    if (tile == null) {
      console.log(
        "Tile in position: ",
        tile.position,
        " is unreachable. Error: tile is null"
      );
      return true;
    }
    if (!tile.walkable) {
      console.log(
        "Tile in position: ",
        tile.position,
        " is unreachable. Error: tile is not walkable"
      );
      return true;
    }

    for (let n of tile.neighbors) {
      if (this.field[n.y][n.x].walkable) {
        return false;
      }
    }
    console.log(
      "Tile in position: ",
      tile.position,
      " is unreachable. Error: all neighbors are not walkable"
    );
    return true;
  }
}
