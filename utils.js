import fs from "fs";

/**
 * Sorts an array of objects by a key
 *
 * @param {Array} array
 * @param {string} key
 * @returns {Array}
 */
export function sortByKey(array, key) {
  return array.sort(function (a, b) {
    var x = a[key];
    var y = b[key];
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

/**
 * Returns the Manhattan distance between two points,
 * a and b can be either Position or {x:number, y:number}
 *
 * @param {Position} a
 * @param {Position} b
 *
 * @returns {number}
 */
export function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Checks whether a a position is fully aligned with the grid
 *
 * @param {Position} pos
 */
export function hasCompletedMovement(pos) {
  return pos.x % 1 === 0.0 && pos.y % 1 === 0.0;
}

export function mergeMaps(maps) {
  const mergedMap = new Map();
  for (const map of maps) {
    for (const [key, value] of map) {
      if (!mergedMap.has(key)) {
        mergedMap.set(key, value);
      }
    }
  }
  return mergedMap;
}

export function parseArgs(args) {
  let params = {
    USE_PDDL: false,
    BLOCKING_DISTANCE: 3,
    BOOST: false,
    CLS_DLV: 2,
    CLS_PAR: 3,
    NRIDERS: 1,
    POP: 100,
    GEN: 30,
    PORT: 3000,
    PREFIX: "",
    PRC_OBS: 1000,
  };

  args = process.argv.slice(2);
  console.log(args);
  if (args.length == 1) {
    const data = fs.readFileSync(args[0], "utf8");
    const jsonData = JSON.parse(data);
    console.log(jsonData);
    params = jsonData;
  } else {
    for (let i = 0; i < args.length; i += 2) {
      switch (args[i]) {
        case "USE_PDDL":
          params.USE_PDDL = args[i + 1] === "true";
          break;

        case "BOOST":
          params.BOOST = args[i + 1] === "true";
          break;
        case "BLOCKING_DISTANCE":
          params.BLOCKING_DISTANCE = Number(args[i + 1]);
          break;
        case "CLS_DLV":
          params.CLS_DLV = Number(args[i + 1]);
          break;
        case "CLS_PAR":
          params.CLS_PAR = Number(args[i + 1]);
          break;
        case "NRIDERS":
          params.NRIDERS = Number(args[i + 1]);
          break;
        case "POP":
          params.POP = Number(args[i + 1]);
          break;
        case "GEN":
          GEN = Number(args[i + 1]);
          break;
        case "PORT":
          PORT = Number(args[i + 1]);
          break;
        case "PREFIX":
          PREFIX = args[i + 1];
          break;
        case "PRC_OBS":
          PRC_OBS = Number(args[i + 1]);
          break;
      }
    }
  }

  return [
    params.USE_PDDL,
    params.BLOCKING_DISTANCE,
    params.BOOST,
    params.CLS_DLV,
    params.CLS_PAR,
    params.NRIDERS,
    params.POP,
    params.GEN,
    params.PORT,
    params.PREFIX,
    params.PRC_OBS,
  ];
}
