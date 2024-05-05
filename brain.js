import { Position } from "./data/position";
import { Field } from "./data/field";

export class Reasoning_1 {
    // output : ordered list of actions
    // optimize for score
    realScore(parcel) {
        const parcelPosition = new Position(parcel.x, parcel.y);
        const distanceToParcel = bfs(new Position(this.x, this.y), parcelPosition).length - 1;
        const deliveryZonePosition = Field.getClosestDeliveryZone(parcelPosition);
        const distanceToDeliveryZone = bfs(parcelPosition, deliveryZonePosition).length - 1;
        return parcel.score - distanceToParcel - distanceToDeliveryZone;
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