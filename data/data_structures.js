class Agent {
    constructor(x, y, maxViewingDistance) {
        this.x = x;
        this.y = y;
        this.maxViewingDistance = maxViewingDistance;
        this.parcels = []; // List of parcels currently held
        this.score = 0;
    }

    // Method to move the agent
    move(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    // Method to pick up a parcel
    pickUpParcel(parcel) {
        this.parcels.push(parcel);
    }

    // Method to deliver parcels to the closest delivery zone
    deliverParcels() {
        // Move towards the closest known delivery zone
        // Use Djikstra to find the shortest path
        // Put down all the parcels that the agent is carrying
        for (let i = 0; i < this.parcels.length; i++) {
            const parcel = this.parcels[i];
            // This check may be redundant
            if (map.isDeliveryZone(this.x, this.y)) {
                this.score += parcel.score;
                this.parcels.splice(i, 1);
                i--;
            }
        }
    }
}

class Parcel {
    constructor(x, y, score, timer) {
        this.x = x;
        this.y = y;
        this.score = score;
        this.timer = timer;
    }

    updateTimer() {
        // Are we supposed to implement this or is it given to us?
    }
}

// Define the Map class
class Map {
    constructor(rows, columns, tilesConfig) {
        this.rows = rows;
        this.columns = columns;
        this.tilesConfig = tilesConfig;
    }

    // Check if a given position is within the map boundaries
    isWithinBounds(x, y) {
        return x >= 0 && x < this.rows && y >= 0 && y < this.columns;
    }

    // Check if a position is walkable
    isWalkable(x, y) {
        if (this.isWithinBounds(x, y)) {
            return this.tilesConfig[x][y] === '1';
        }
        return false;
    }

    // Check if a position is a delivery zone
    isDeliveryZone(x, y) {
        if (this.isWithinBounds(x, y)) {
            return this.tilesConfig[x][y] === '2';
        }
        return false;
    }
}