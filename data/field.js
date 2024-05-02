import { Tile } from "./tile.js";
import { Position, Direction } from "./position.js";

export class Field {
    init(width, height, tiles) {
      this.width = width;
      this.height = height;
      this.field = [];
      for (let i = 0; i < height; i++) {
        this.field[i] = [];
        for (let j = 0; j < width; j++) {
          let found = false;
          for (const t of tiles) {
            if (t.x == j && t.y == i) {
              found = true;
              break;
            }
          }
          let pos = new Position(j, i);
          this.field[i][j] = new Tile(pos, found, false);
        }
      }
  
          //load neighbors
    for (let i = 0; i < this.height; i++) {
        for (let j = 0; j < this.width; j++) {
          if (this.field[i][j].walkable) {
            this.field[i][j].set_neighbors(this.neighbors({ x: j, y: i }));
          }
        }
      }
    }
  
    getTile(tile) {
      return this.field[tile.get_y()][tile.get_x()];
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
    
    // figure out which of the two neighbors functions we'll keep
    neighbors({ x, y }) {
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
      queue.push(this.getTile(start));
  
      while (queue.length > 0) {
        const node = queue.shift();
        for (const n of node.neighbors) {
          const n_tile = this.getTile(n);
          if (distance[n_tile.id] == undefined) {
            par[n_tile.id] = node;
            distance[n_tile.id] = distance[node.id] + 1;
            queue.push(n_tile);
          }
        }
      }
      console.log(distance[end.id]);
  
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