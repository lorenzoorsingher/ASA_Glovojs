import { Tile } from "./tile.js";
import { Position, Direction } from "./position.js";
import { manhattanDistance, sortByKey } from "../utils.js";
import { Beliefset } from "@unitn-asa/pddl-client";
import { bfs_pddl } from "../planner/bfs_pddl.js";
import { PlansCache } from "../planner/plan_cacher.js";

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
 */
export class Field {
  constructor(usePddl = false, closest_dlv = 2, boost = false) {
    this.USE_PDDL = usePddl;
    this.CLOSEST_DLV = closest_dlv;
    this.BOOST = boost;
    this.beliefSet = new Beliefset();
    this.plansCache = new PlansCache();
  }

  init(width, height, tiles) {
    this.width = width;
    this.height = height;
    this.field = [];
    this.parcelSpawners = [];
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
            this.beliefSet.declare(
              `connected t_${j}_${i} t_${neighbor.x}_${neighbor.y}`
            );
          }
        }
      }

      //load delivery zones
      this.deliveryZones = this.getDeliveryZones();
    }

    if (this.BOOST) {
      console.log("[TURBO] Boosting search");
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          let startPos = new Position(j, i);
          let startTile = this.getTile(startPos);
          if (startTile.walkable) {
            for (let k = 0; k < height; k++) {
              for (let l = 0; l < width; l++) {
                let endPos = new Position(l, k);
                let endTile = this.getTile(endPos);
                if (endTile.walkable) {
                  let couple = {
                    start: startPos,
                    end: endPos,
                    i: 0,
                    j: 0,
                  };
                  this.bfsWrapper([couple], [], true);
                }
              }
            }
          }
        }
      }
      this.plansCache.resetMetrics();
      console.log("[TURBO] Boost finished");
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
    // console.log("Getting tile at position:", pos);
    if (pos.x < 0 || pos.x >= this.width || pos.y < 0 || pos.y >= this.height) {
      console.log("Tile out of bounds");
      return -1;
    }
    let tile = this.field[pos.y][pos.x];
    return tile;
  }

  getNeighbors(x, y) {
    const neighbors = [];
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]; // Left, Right, Up, Down

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
      this.beliefSet.declare(`connected t_${x}_${y} t_${x - 1}_${y}`);
    }
    if (x < this.width - 1 && this.field[y][x + 1].walkable) {
      neighbors.push({ x: x + 1, y });
      this.beliefSet.declare(`connected t_${x}_${y} t_${x + 1}_${y}`);
    }
    if (y > 0 && this.field[y - 1][x].walkable) {
      neighbors.push({ x, y: y - 1 });
      this.beliefSet.declare(`connected t_${x}_${y} t_${x}_${y - 1}`);
    }
    if (y < this.height - 1 && this.field[y + 1][x].walkable) {
      neighbors.push({ x, y: y + 1 });
      this.beliefSet.declare(`connected t_${x}_${y} t_${x}_${y + 1}`);
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
  bfsSingle(start, end, blocking_agents) {
    const par = {};
    const queue = [];
    const distance = {};

    // console.log("[BFSSINGLE] called from: ", start, " to: ", end);
    let startTile = this.getTile(start);
    let endTile = this.getTile(end);

    // check whether the start or end tile is unreachable
    if (
      this.isTileUnreachable(startTile, blocking_agents) ||
      this.isTileUnreachable(endTile, blocking_agents)
    ) {
      return -1;
    }

    let blocking = [];
    for (const a of blocking_agents.values()) {
      blocking.push(a.x + "-" + a.y);
    }
    // BFS
    distance[startTile.id] = 0;
    queue.push(startTile);
    while (queue.length > 0) {
      const node = queue.shift();
      for (const n of node.getNeighbors()) {
        if (!blocking.includes(n.x + "-" + n.y)) {
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
    let currentNode = endTile.id;
    path.push(endTile.id);
    while (par[currentNode] !== undefined) {
      path.push(par[currentNode].id);
      currentNode = par[currentNode].id;
    }

    path = path.reverse();

    if (path.length <= 1) {
      if (!start.equals(end)) {
        path = -1;
      }
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
  async getClosestDeliveryZones(pos, blocking_agents) {
    // only consider the 2 closest delivery zones in manhattan distance
    let zones = this.deliveryZones.map((deliveryZone, index) => ({
      zone: deliveryZone,
      dist: manhattanDistance(pos, deliveryZone),
    }));
    zones = sortByKey(zones, "dist");
    let couples = zones.slice(0, this.CLOSEST_DLV).map((entry, index) => ({
      start: pos,
      end: entry.zone,
      i: index,
      j: 0, // We're using j=0 as we don't need it for this function
    }));

    const bfsResults = await this.bfsWrapper(couples, blocking_agents);
    // console.log("BFS results:", bfsResults);
    let closest = bfsResults
      .map((result) => {
        if (result.path !== -1) {
          return {
            x: this.deliveryZones[result.i].x,
            y: this.deliveryZones[result.i].y,
            distance: result.path.length - 1,
            path: result.path,
          };
        }
        return null;
      })
      .filter((result) => result !== null);

    closest = sortByKey(closest, "distance");

    // console.log("Closest delivery zones:", closest);
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
  async getRandomSpawnable(player_position, blocking_agents) {
    // console.log("Looking for a SPAWNABLE tile from ", player_position);
    const randomOrder = this.parcelSpawners.sort(() => Math.random() - 0.5);
    for (const spawner of randomOrder) {
      //const tile = this.getTile(spawner);
      let to_spawner = await this.bfsWrapper(
        [
          {
            start: player_position,
            end: spawner,
            i: 0,
            j: 0,
          },
        ],
        blocking_agents
      );

      // console.log("[SOAWNER] ", to_spawner);
      if (to_spawner.length > 0) {
        // console.log("Found a spawnable tile at ", to_spawner);
        // console.log("Spawner: ", to_spawner[0].path);
        return to_spawner;
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
  isTileUnreachable(tile, blocking_agents = []) {
    let blocking = [];
    for (const a of blocking_agents.values()) {
      blocking.push(a.x + "-" + a.y);
    }
    if (!tile || !(tile instanceof Tile)) {
      console.error("⚠️ Invalid tile passed to isTileUnreachable:", tile);
      return true;
    }
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

  async bfsWrapper(couples, blocking_agents, turbo = false) {
    // console.log(
    //   "bfsWrapper called with couples:",
    //   JSON.stringify(couples, null, 2)
    // );

    if (!Array.isArray(couples) || couples.length === 0) {
      console.warn("No valid couples provided to bfsWrapper");
      return [];
    }

    // CACHE FILTERING
    let filtered_couples = [];
    let filtered_refs = new Map();
    let cached_couples = [];
    for (let k = 0; k < couples.length; k++) {
      let start = couples[k].start;
      let end = couples[k].end;
      let i = couples[k].i;
      let j = couples[k].j;
      // console.log("Checking cache for:", start, end, blocking_agents);
      let entry = this.plansCache.getEntry(start, end, blocking_agents);

      if (entry == -1) {
        filtered_couples.push(couples[k]);
        filtered_refs.set(i + "-" + j, { start: start, end: end });
      } else {
        cached_couples.push({ i: i, j: j, path: entry });
      }
    }

    // console.log(couples);
    // console.log(filtered_couples);
    const processedCouples = filtered_couples
      .map((couple, index) => {
        if (couple.start instanceof Tile) {
          console.log("[BFSWRAPPER] Start is a tile");
          crash = 234243;
        } else if (couple.start instanceof Position) {
          // console.log("[BFSWRAPPER] Start is a position");
        } else {
          console.log("[BFSWRAPPER] Start is neither a tile nor a position");
          crash = 234243;
        }

        // console.log("[BFSWRAPPER] Processing couple:", couple);

        if (!couple || typeof couple !== "object") {
          console.warn(`Invalid couple at index ${index}:`, couple);
          return null;
        }

        const startPos =
          couple.start instanceof Tile
            ? couple.start.position
            : couple.start instanceof Position
            ? couple.start
            : new Position(couple.start.x, couple.start.y);
        const endPos =
          couple.end instanceof Tile
            ? couple.end.position
            : couple.end instanceof Position
            ? couple.end
            : new Position(couple.end.x, couple.end.y);

        if (
          isNaN(startPos.x) ||
          isNaN(startPos.y) ||
          isNaN(endPos.x) ||
          isNaN(endPos.y)
        ) {
          console.warn(`Invalid coordinates for couple at index ${index}:`, {
            start: startPos,
            end: endPos,
          });
          return null;
        }

        const roundedStart = new Position(
          Math.round(startPos.x),
          Math.round(startPos.y)
        );
        const roundedEnd = new Position(
          Math.round(endPos.x),
          Math.round(endPos.y)
        );

        return { ...couple, start: roundedStart, end: roundedEnd };
      })
      .filter((couple) => couple !== null);

    // if (processedCouples.length === 0) {
    //   console.warn("No valid couples after processing in bfsWrapper");
    //   return [];
    // }

    let results = [];
    if (this.USE_PDDL && processedCouples.length > 0 && !turbo) {
      // console.log(processedCouples);
      results = await bfs_pddl(processedCouples, blocking_agents);
      // ddd = 8;
    } else {
      results = this.bfs(processedCouples, blocking_agents);
    }

    for (const res of results) {
      let ref = filtered_refs.get(res.i + "-" + res.j);
      // console.log("res", res);
      // console.log("filtered_refs", filtered_refs);
      this.plansCache.setEntry(ref.start, ref.end, blocking_agents, res.path);
    }

    let merged_results = cached_couples.concat(results);
    return merged_results;
  }

  bfs(couples, blocking_agents) {
    if (!Array.isArray(couples)) {
      console.warn("bfs received non-array couples:", couples);
      return [];
    }
    return couples.map((couple) => {
      const path = this.bfsSingle(couple.start, couple.end, blocking_agents);
      return { i: couple.i, j: couple.j, path: path };
    });
  }
}
