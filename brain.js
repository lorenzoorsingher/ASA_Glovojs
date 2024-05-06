import { Position } from "./data/position.js";
import { Field } from "./data/field.js";
import { Action } from "./data/action.js";

export class Reasoning_1 {
    constructor(field, parcels) {
        this.field = field;
        this.parcels = parcels;
        this.parcelsQueue = this.orderParcelsByScore(parcels);
        // this.plan = this.createPlan(parcelsQueue)
    }

    orderParcelsByScore(parcels) {
        // Array to store parcel IDs along with their scores
        const parcelScores = [];
        parcels.forEach((parcel, parcelId) => {
            const score = computeRealScore(parcel);
            parcelScores.push({ parcelId, score });
        });
        parcelScores.sort((a, b) => b.score - a.score);
        return parcelScores.map(entry => entry.parcelId);
    }

    computeRealScore(parcel) {
        const parcelPosition = new Position(parcel.x, parcel.y);
        const distanceToParcel = bfs(new Position(this.x, this.y), parcelPosition).length - 1;
        const deliveryZonePosition = Field.getClosestDeliveryZone(parcelPosition);
        const distanceToDeliveryZone = bfs(parcelPosition, deliveryZonePosition).length - 1;
        return parcel.score - distanceToParcel - distanceToDeliveryZone;
    }

    createPlan(currentBestScore, goals) {
        const path = bfs(new Position(this.x, this.y), goals[0]);
        const actions = [];
        actions.concat(Action.pathToAction(path));
        const pathToDeliveryZone = bfs(goals[0], Field.getClosestDeliveryZone(goals[0])); 
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