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
