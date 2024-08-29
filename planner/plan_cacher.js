import { Position } from "../data/position.js";

export class PlansCache {
  constructor(max_size = -1) {
    this.paths_cache = new Map();
    this.cache_hits = 0;
    this.cache_misses = 0;
  }

  getCacheID(startTile, endTile, blocking_agents) {
    let blocking = [];
    for (const a of blocking_agents.values()) {
      blocking.push(a.x + "-" + a.y);
    }

    //console.log("startTile", startTile);
    // creates a unique cache entry for the combination of start, end and blocking agents
    blocking = blocking.sort();
    let entry =
      Position.serialize(startTile) +
      "_" +
      Position.serialize(endTile) +
      "_" +
      blocking.join("_");

    return entry;
  }

  getEntry(startTile, endTile, blocking_agents) {
    let entry = this.getCacheID(startTile, endTile, blocking_agents);

    // check if the path is already in the cache
    if (this.paths_cache.has(entry)) {
      this.cache_hits += 1;

      return this.paths_cache.get(entry);
    } else {
      this.cache_misses += 1;
    }
    return -1;
  }

  setEntry(startTile, endTile, blocking_agents, path) {
    let entry = this.getCacheID(startTile, endTile, blocking_agents);
    this.paths_cache.set(entry, path);
  }

  printMetrics() {
    console.log("[Cache]hits: ", this.cache_hits);
    console.log("[Cache] size: ", this.paths_cache.size);
    console.log(
      "[Cache] hit rate: ",
      ((this.cache_hits / (this.cache_hits + this.cache_misses)) * 100).toFixed(
        2
      ) + "%"
    );
  }
}
