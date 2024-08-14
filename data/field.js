import { Tile } from "./tile.js";
import { Position, Direction } from "./position.js";
import { sortByKey } from "../utils.js";

// import { VERBOSE } from "../agent.js";
const VERBOSE = false;
export class Field {
  init(width, height, tiles) {
    this.width = width;
    this.height = height;
    this.field = [];
    this.parcelSpawners = [];
    this.paths_cache = new Map();
    this.cache_hits = 0;
    this.cache_misses = 0;
    this.hit_rate = 0;

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
    for (const t of tiles) {
      if (t.parcelSpawner) {
        this.parcelSpawners.push(new Position(t.x, t.y));
      }
    }
    //load neighbors
    for (let i = 0; i < this.height; i++) {
      for (let j = 0; j < this.width; j++) {
        if (this.field[i][j].walkable) {
          this.field[i][j].setNeighbors(this.neighbors(new Position(j, i)));
        }
      }
    }
    this.deliveryZones = this.getDeliveryZones();
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
        tiles[i][j] = cell;
      }
    }

    return tiles;
  }

  getTile(pos) {
    if (pos.x < 0 || pos.x >= this.width || pos.y < 0 || pos.y >= this.height) {
      console.log("Tile out of bounds");
      return -1;
    }
    let tile = this.field[pos.y][pos.x];
    //console.log("TL:", this.field[pos.y][pos.x].position);
    if (tile == undefined) {
      console.log("Tile is null: ", pos);
      aaaa = 3;
    }
    return tile;
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

  bfs(start, end, blocking_agents) {
    const par = {};
    const queue = [];
    const distance = {};

    const CACHE = true;

    let blocking = [];
    for (const a of blocking_agents.values()) {
      blocking.push(a.x + "-" + a.y);
      //console.log("Blocking: ", blocking);
    }

    blocking = blocking.sort();
    let entry = start.id + "_" + end.id + "_" + blocking.join("_");
    if (CACHE) {
      // console.log("Blocking: ", blocking);

      // console.log("Blocking_sort: ", blocking);
      // console.log("Start: ", start.id);
      // console.log("End: ", end.id);

      // let hit = false;
      if (this.paths_cache.has(entry)) {
        this.cache_hits += 1;
        // console.log("CACHE HIT ", this.cache_hits);
        // hit = true;
        // console.log(
        //   "HIT RATE: ",
        //   Math.round((this.cache_hits / this.paths_cache.size) * 10000) / 100,
        //   "%"
        // );

        return this.paths_cache.get(entry);
      } else {
        this.cache_misses += 1;
      }
    }

    if (
      this.isTileUnreachable(start, blocking) ||
      this.isTileUnreachable(end, blocking)
    ) {
      //console.log("BFS: Start or End tile is unreachable");
      return -1;
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
          //console.log("Tile " + n.x + "-" + n.y + " is blocked");
        }

        //console.log(n.x + "-" + n.y);
      }
    }
    VERBOSE && console.log(distance[end.id]);

    let path = [];
    let currentNode = end.id;
    path.push(end.id);
    while (par[currentNode] !== undefined) {
      path.push(par[currentNode].id);
      currentNode = par[currentNode].id;
    }

    if (path.length <= 1) {
      if (!start.position.equals(end.position)) {
        //console.log("GAWD DAMN it. Path is empty");
        path = -1;
      } else {
        //console.log("Start and end are the same");
      }
    }

    // console.log("Path: ", path);

    // if (!hit) {
    if (CACHE) {
      this.paths_cache.set(entry, path);
    }
    // }

    return path;
  }

  getClosestDeliveryZones(pos, blocking_agents) {
    const x = pos.x;
    const y = pos.y;

    let closest = [];

    for (let d of this.deliveryZones) {
      const path = this.bfs(
        this.getTile(d),
        this.getTile(pos),
        blocking_agents
      );
      if (path != -1) {
        const distance = path.length - 1;
        closest.push({ x: d.x, y: d.y, distance: distance, path: path });
      }
    }

    closest = sortByKey(closest, "distance");
    // console.log("Blocking: ", blocking_agents);
    // console.log("Closest delivery zones: ", closest);
    return closest;
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

  getRandomSpawnable(player_position, blocking_agents) {
    // console.log("Looking for a SPAWNABLE tile from ", player_position);
    const randomOrder = this.parcelSpawners.sort(() => Math.random() - 0.5);
    for (const spawner of randomOrder) {
      const tile = this.getTile(spawner);
      let path = this.bfs(tile, this.getTile(player_position), blocking_agents);
      if (path != -1) {
        return path;
      }
    }

    return -1;
  }

  isDeliveryZone(pos) {
    return this.field[pos.y][pos.x].delivery;
  }

  isTileUnreachable(tile, blocking = []) {
    if (blocking.includes(tile.id) && blocking.length > 0) {
      return true;
    }
    if (tile == null) {
      return true;
    }
    if (!tile.walkable) {
      return true;
    }

    for (let n of tile.neighbors) {
      if (this.field[n.y][n.x].walkable) {
        return false;
      }
    }
    return true;
  }
}
