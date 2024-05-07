import { Position } from "./data/position.js";
import { Action, ActionType } from "./data/action.js";
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

  updateParcelsQueue() {
    this.parcelsQueue = this.orderParcelsByScore(this.parcels);
    return this.createPlan();
  }

  tempUpdateParcels(parcels) {
    this.parcels = parcels;
    this.parcelsQueue = this.orderParcelsByScore(this.parcels);
    return this.createPlan();
  }

  orderParcelsByScore(parcels) {
    console.log("––––––––––––––––––––––––––––––––-");
    console.log("––––––––––––––––––––––––––––––––-");
    console.log(parcels.size, " parcels sensed.");
    if (parcels.size === 0) {
      return [];
    }

    const parcelScores = [];
    for (const [parcelId, parcel] of parcels.entries()) {
      const score = this.computeRealScore(parcel);
      VERBOSE && console.log("Best score for: ", parcelId, " is: ", score);
      let position = new Position(parcel.x, parcel.y);
      if(!this.field.isTileUnreachable(this.field.getTile(position))){
        parcelScores.push({ parcelId, score, position });
      }
    }

    parcelScores.sort((a, b) => b.score - a.score);
    console.log(
      "📦",
      parcelScores[0].parcelId +
        " is the best parcel to deliver with score: " +
        parcelScores[0].score
    );
    return parcelScores.map((entry) => entry.parcelId);
  }

  // addParcelandOrder(parcel) {
  //     this.parcels.set(parcel.id, parcel);
  //     this.parcelsQueue = this.orderParcelsByScore(this.parcels);
  //     console.log("Added parcel to agent's parcels: ", this.parcelsQueue)
  // }

  // removeParcel(parcelId) {
  //     this.parcels.delete(parcelId);
  //     this.parcelsQueue = this.orderParcelsByScore(this.parcels);
  // }

  computeRealScore(parcel) {
    const playerPosition = new Position(this.x, this.y);
    const parcelPosition = new Position(parcel.x, parcel.y);

    const playerTile = this.field.getTile(playerPosition);
    const parcelTile = this.field.getTile(parcelPosition);

    VERBOSE &&
      console.log(
        "Calculating distance from player in position: ",
        playerPosition.x,
        playerPosition.y,
        "to parcel in position: ",
        parcelPosition.x,
        parcelPosition.y
      );
    const distanceToParcel = this.field.bfs(playerTile, parcelTile).length - 1;

    const deliveryZoneTile = this.field.getClosestDeliveryZone(parcelPosition); // returns a tile
    const distanceToDeliveryZone =
      this.field.bfs(parcelTile, deliveryZoneTile).length - 1;
    const score = parcel.reward - distanceToParcel - distanceToDeliveryZone;
    return score;
  }

  createPlan() {
    if (this.parcelsQueue.length === 0) {
      // walk randomly
      return [];
    } else {
      const bestParcel = this.parcels.get(this.parcelsQueue[0]);
      const bestParcelPosition = new Position(bestParcel.x, bestParcel.y);
      const bestParcelTile = this.field.getTile(bestParcelPosition);

      console.log(
        "🧠 Creating plan for parcel: ",
        bestParcel,
        " with position ",
        bestParcelPosition.x,
        bestParcelPosition.y
      );
      const playerTile = this.field.getTile(new Position(this.x, this.y));

      console.log("🧍 Starting from player tile ", playerTile.id);
      const path = this.field.bfs(bestParcelTile, playerTile);

      const pathToDeliveryZone = this.field.bfs(
        this.field.getClosestDeliveryZone(bestParcelPosition),
        bestParcelTile
      );
      const goPickUpActions = Action.pathToAction(path, ActionType.PICKUP, bestParcel);
      const goDeliverActions = Action.pathToAction(
        pathToDeliveryZone,
        ActionType.PUTDOWN,
        null
      );
      return goPickUpActions.concat(goDeliverActions);
    }
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
