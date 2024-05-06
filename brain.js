import { Position } from "./data/position.js";
import { Field } from "./data/field.js";
import { Action } from "./data/action.js";
import { VERBOSE } from "./agent.js";

export class Reasoning_1 {
    init(field, parcels, playerPosition) {
        this.field = field;
        this.parcels = parcels;
        this.x = playerPosition.x;
        this.y = playerPosition.y;
        this.parcelsQueue = this.orderParcelsByScore(parcels);
        // this.plan = this.createPlan(parcelsQueue)
    }

    updateField(field) {
        this.field = field;
    }

    updatePlayerPosition(pos) {
        this.x = pos.x;
        this.y = pos.y;
    }

    orderParcelsByScore(parcels) {
        console.log(parcels.size)
        if (parcels.size === 0) {
            return [];
        }
    
        const parcelScores = [];

        for (const [parcelId, parcel] of parcels.entries()) {
            console.log("Computing score for parcel: ", parcelId);
            const score = this.computeRealScore(parcel);
            parcelScores.push({ parcelId, score });
        }

        parcelScores.sort((a, b) => b.score - a.score);
        console.log(parcelScores[0].parcelId + " is the best parcel to deliver.")
        return parcelScores.map(entry => entry.parcelId);
    }

    addParcelandOrder(parcel) {
        this.parcels.set(parcel.id, parcel);
        this.parcelsQueue = this.orderParcelsByScore(this.parcels);
        console.log("Added parcel to agent's parcels: ", this.parcelsQueue)
    }

    removeParcel(parcelId) {
        this.parcels.delete(parcelId);
        this.parcelsQueue = this.orderParcelsByScore(this.parcels);
    }

    computeRealScore(parcel) {
        const playerPosition = new Position(this.x, this.y);
        const parcelPosition = new Position(parcel.x, parcel.y);

        const playerTile = this.field.getTile(playerPosition);
        const parcelTile = this.field.getTile(parcelPosition);

        VERBOSE && console.log("Calculating distance from player in position: ", playerPosition.x, playerPosition.y, "to parcel in position: ",  parcelPosition.x, parcelPosition.y);
        const distanceToParcel = this.field.bfs(playerTile, parcelTile).length - 1;

        const deliveryZoneTile = this.field.getClosestDeliveryZone(parcelPosition); // returns a tile
        const distanceToDeliveryZone = this.field.bfs(parcelTile, deliveryZoneTile).length - 1;
        return parcel.score - distanceToParcel - distanceToDeliveryZone;
    }

    createPlan(currentBestScore, goals) {
        const path = bfs(new Position(this.x, this.y), goals[0]);
        const actions = [];
        actions.concat(Action.pathToAction(path));
        const pathToDeliveryZone = field.bfs(goals[0], field.getClosestDeliveryZone(goals[0])); 
        actions.concat(Action.pathToAction(pathToDeliveryZone));
        return actions;
    }
}

export class Reasoning_2 {}

export class Reasoning_3 {}

/*

2 : delivery zone
1 : walkable
0 : not walkable

map = [
    [0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    [2, 1, 1, 1, 1, 1, 1, 1, 1, 2],
    [0, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    [0, 0, 1, 0, 1, 0, 1, 0, 0, 2],
    [2, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    [0, 0, 1, 0, 1, 1, 1, 0, 0, 1],
    [0, 0, 1, 2, 1, 0, 1, 0, 0, 2]
]

*/