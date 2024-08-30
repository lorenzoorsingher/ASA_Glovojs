import { Position } from "../data/position.js";

export class PlansCache {
  constructor(max_size = -1) {
    this.paths_cache = new Map();
    this.cache_hits = 0;
    this.cache_hits_inv = 0;
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

    let entry_inv =
      Position.serialize(endTile) +
      "_" +
      Position.serialize(startTile) +
      "_" +
      blocking.join("_");

    return [entry, entry_inv];
  }

  getEntry(startTile, endTile, blocking_agents) {
    let [entry, entry_inv] = this.getCacheID(
      startTile,
      endTile,
      blocking_agents
    );

    // check if the path is already in the cache
    if (this.paths_cache.has(entry)) {
      this.cache_hits += 1;

      return this.paths_cache.get(entry);
    }

    if (this.paths_cache.has(entry_inv)) {
      this.cache_hits += 1;
      this.cache_hits_inv += 1;
      return this.paths_cache.get(entry_inv).slice().reverse();
    }

    this.cache_misses += 1;
    return -1;
  }

  setEntry(startTile, endTile, blocking_agents, path) {
    let [entry, entry_inv] = this.getCacheID(
      startTile,
      endTile,
      blocking_agents
    );

    this.paths_cache.set(entry, path);

    let inv_path = -1;
    if (path != -1) {
      inv_path = path.slice().reverse();
    }
    this.paths_cache.set(inv_path);
  }

  printMetrics() {
    console.log("[Cache]hits: ", this.cache_hits);
    console.log("[Cache]hits_inv: ", this.cache_hits_inv);
    console.log("[Cache] size: ", this.paths_cache.size);
    console.log(
      "[Cache] hit rate: ",
      ((this.cache_hits / (this.cache_hits + this.cache_misses)) * 100).toFixed(
        2
      ) + "%"
    );
  }

  resetMetrics() {
    this.cache_hits = 0;
    this.cache_hits_inv = 0;
    this.cache_misses = 0;
  }
}
