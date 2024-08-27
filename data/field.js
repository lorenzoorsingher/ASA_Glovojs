import { Tile } from "./tile.js";
import { Position, Direction } from "./position.js";
import { sortByKey } from "../utils.js";
import { Beliefset } from "@unitn-asa/pddl-client";
import { bfs_pddl } from "../planner/bfs_pddl.js";

const VERBOSE = false;

/**
 * Represents the game field where the agents move
 * and contains the functions to interact with it
 *
 * @param {number} width width of the field
 * @param {number} height height of the field
 * @param {Array} tiles array of tiles
 *
 * @property {number} width width of the field
 * @property {number} height height of the field
 * @property {Array} field 2D array of tiles
 * @property {Array} parcelSpawners array of spawnable positions
 * @property {Map} paths_cache cache of paths
 * @property {number} cache_hits number of cache hits
 * @property {number} cache_misses number of cache misses
 * @property {number} hit_rate cache hit rate
 */
export class Field {

  constructor(usePddl = false) {
    this.USE_PDDL = usePddl;
    this.beliefSet = new Beliefset();
  }

  init(width, height, tiles) {
    this.width = width;
    this.height = height;
    this.field = [];
    this.parcelSpawners = [];
    this.paths_cache = new Map();
    this.cache_hits = 0;
    this.cache_misses = 0;
    this.hit_rate = 0;
    this.beliefSet = new Beliefset();

      // Initialize the field
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
            // Add object to beliefSet if the tile is walkable
            if (found) {
                this.beliefSet.addObject(`t_${j}_${i}`);
            }
        }
    }

    // populate the parcel spawners list
    for (const t of tiles) {
      if (t.parcelSpawner) {
        this.parcelSpawners.push(new Position(t.x, t.y));
      }
    }

    // //load neighbors
    // for (let i = 0; i < this.height; i++) {
    //   for (let j = 0; j < this.width; j++) {
    //     if (this.field[i][j].walkable) {
    //       this.field[i][j].setNeighbors(this.neighbors(new Position(j, i)));
    //       let neighbors = this.neighbors(new Position(j, i));
    //       for (let neighbor of neighbors) {
    //         this.beliefSet.declare(`connected t_${j}_${i} t_${neighbor.x}_${neighbor.y}`);
    //       }
    //     }
    //   }
    // }

  // Populate neighbors and connected predicates
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
        if (this.field[i][j].walkable) {
            let neighbors = this.getNeighbors(j, i);
            this.field[i][j].setNeighbors(neighbors);
            for (let neighbor of neighbors) {
                this.beliefSet.declare(`connected t_${j}_${i} t_${neighbor.x}_${neighbor.y}`);
            }
        }
    } 

    //load delivery zones
    this.deliveryZones = this.getDeliveryZones();
  }
}

  /**
   * Returns a synthetic representation of the map
   * used by the dashboard
   *
   * @returns {Array} array of the tiles
   */
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

  /**
   * Returns the tile at a given position
   *
   * @param {Position} pos position of the tile
   *
   * @returns {Tile} tile at the given position
   */
  getTile(pos) {
    if (pos.x < 0 || pos.x >= this.width || pos.y < 0 || pos.y >= this.height) {
      console.log("Tile out of bounds");
      return -1;
    }
    let tile = this.field[pos.y][pos.x];
    return tile;
  }

  getNeighbors(x, y) {
    const neighbors = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // Left, Right, Up, Down

    for (const [dx, dy] of directions) {
        const newX = x + dx;
        const newY = y + dy;
        if (this.isValidPosition(newX, newY) && this.field[newY][newX].walkable) {
            neighbors.push(new Position(newX, newY));
        }
    }

    return neighbors;
  }

  isValidPosition(x, y) {
      return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Returns the walkable neighbors of a given position
   *
   * @param {Position} pos position of the tile
   *
   * @returns {Array} array of walkable neighbors
   */
  neighbors(pos) {
    let x = pos.x;
    let y = pos.y;
    const neighbors = [];
    if (x > 0 && this.field[y][x - 1].walkable) {
      neighbors.push({ x: x - 1, y });
      this.beliefSet.declare(`connected t_${x}_${y} t_${x-1}_${y}`);
    }
    if (x < this.width - 1 && this.field[y][x + 1].walkable) {
      neighbors.push({ x: x + 1, y });
      this.beliefSet.declare(`connected t_${x}_${y} t_${x+1}_${y}`);
    }
    if (y > 0 && this.field[y - 1][x].walkable) {
      neighbors.push({ x, y: y - 1 });
      this.beliefSet.declare(`connected t_${x}_${y} t_${x}_${y-1}`);
    }
    if (y < this.height - 1 && this.field[y + 1][x].walkable) {
      neighbors.push({ x, y: y + 1 });
      this.beliefSet.declare(`connected t_${x}_${y} t_${x}_${y+1}`);
    }
    return neighbors;
  }

  /**
   * Computes the shortest path between two positions using
   * the Breadth First Search algorithm
   *
   * @param {Position} start start position
   * @param {Position} end end position
   * @param {Array} blocking_agents list of blocking agents (tiles to be avoided)
   *
   * @returns {Array} shortest path
   */
  bfs(start, end, blocking_agents) {
    const par = {};
    const queue = [];
    const distance = {};

    const CACHE = true;

    let blocking = [];
    for (const a of blocking_agents.values()) {
      blocking.push(a.x + "-" + a.y);
    }

    // creates a unique cache entry for the combination of start, end and blocking agents
    blocking = blocking.sort();
    let entry = start.id + "_" + end.id + "_" + blocking.join("_");

    // check if the path is already in the cache
    if (CACHE) {
      if (this.paths_cache.has(entry)) {
        this.cache_hits += 1;
        return this.paths_cache.get(entry);
      } else {
        this.cache_misses += 1;
      }
    }

    // check whether the start or end tile is unreachable
    if (
      this.isTileUnreachable(start, blocking) ||
      this.isTileUnreachable(end, blocking)
    ) {
      return -1;
    }

    // BFS
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
        }
      }
    }

    let path = [];
    let currentNode = end.id;
    path.push(end.id);
    while (par[currentNode] !== undefined) {
      path.push(par[currentNode].id);
      currentNode = par[currentNode].id;
    }

    if (path.length <= 1) {
      if (!start.position.equals(end.position)) {
        path = -1;
      }
    }

    // if cache is enabled, store the path in the cache
    if (CACHE) {
      this.paths_cache.set(entry, path);
    }
    return path;
  }


  /**
   * Returns the closest delivery zones to a given position
   *
   * @param {Position} pos starting position
   * @param {Array} blocking_agents list of blocking agents (tiles to be avoided)
   *
   * @returns {Array} array of closest delivery zones
   */
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

  /**
   * Returns all delivery zones in the field
   *
   * @returns {Array} array of delivery zones
   */
  getDeliveryZones() {
    const positions = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.field[y][x].delivery) {
          positions.push(new Position(x, y));
        }
      }
    }
    return positions;
  }

  /**
   * Returns a random spawnable position
   *
   * @param {Position} player_position position of the player
   * @param {Array} blocking_agents list of blocking agents (tiles to be avoided)
   *
   * @returns {Array} path to the spawnable position
   */
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

  /**
   * Checks whether a tile is null, not walkable, under a blocking agent
   * or unreachable from its neighbors
   *
   * @param {Tile} tile tile to be checked
   * @param {Array} blocking list of blocking agents (tiles to be avoided)
   *
   * @returns {boolean} whether the tile is unreachable
   */
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

  async bfsWrapper(start, end, blocking_agents) {
    console.log("bfsWrapper called with start:", start, "end:", end);

    // Ensure start and end are Position objects
    const startPos = start instanceof Tile ? start.position : (start instanceof Position ? start : new Position(start.x, start.y));
    const endPos = end instanceof Tile ? end.position : (end instanceof Position ? end : new Position(end.x, end.y));

    // Round the start and end positions
    const roundedStart = new Position(Math.round(startPos.x), Math.round(startPos.y));
    const roundedEnd = new Position(Math.round(endPos.x), Math.round(endPos.y));

    if (this.USE_PDDL) {
        try {
            console.log("Calling bfs_pddl with rounded positions:", roundedStart, roundedEnd);
            const path = await bfs_pddl(roundedStart, roundedEnd, blocking_agents);
            
            if (path === -1) {
                console.log("PDDL-based BFS failed, falling back to standard BFS");
                return this.bfs(roundedStart, roundedEnd, blocking_agents);
            }
            return path;
        } catch (error) {
            console.error("Error in PDDL-based BFS:", error);
            console.log("Falling back to standard BFS");
            return this.bfs(roundedStart, roundedEnd, blocking_agents);
        }
    } else {
        return this.bfs(roundedStart, roundedEnd, blocking_agents);
    }
  }
}
