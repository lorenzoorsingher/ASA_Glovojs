import { Position } from "./data/position.js";
import { Action, ActionType } from "./data/action.js";
import { Genetic } from "./master_geneticBrain.js";
import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";

/**
 * A rider is a player in the game.
 *
 * @param {string} uname The username of the rider
 *
 * @property {number} carrying amount of points the rider is carrying
 * @property {Array} plan list of actions the rider will take
 * @property {number} no_delivery amount of turns since the rider last delivered
 * @property {Object} config configuration of the game
 * @property {string} uname username of the rider
 * @property {boolean} player_init whether the player has been initialized
 * @property {boolean} putting_down whether the player is putting down a parcel
 * @property {number} plan_cooldown turns until the player can plan again
 * @property {Map} player_parcels parcels the player is carrying
 * @property {Map} blocking_agents agents that are blocking the player
 * @property {Genetic} brain the player's brain
 * @property {DeliverooApi} client the player's client
 * @property {number} id the player's id
 * @property {string} name the player's name
 * @property {number} score the player's score
 * @property {Position} position the player's position
 * @property {Position} src the player's action source position
 * @property {Position} trg the player's action target position
 * @property {Action} nextAction the player's next action
 *
 *
 */
export class Rider {
  constructor(uname) {
    this.uname = uname;

    // Game state
    this.carrying = 0;
    this.plan = [];
    this.no_delivery = 0;
    this.config = {};
    this.player_init = false;
    this.putting_down = false;
    this.plan_cooldown = 0;
    this.player_parcels = new Map();
    this.blocking_agents = new Map();

    //this.brain = new Genetic(this.blocking_agents);
    this.client = new DeliverooApi(
      "http://localhost:8080/?name=" + this.uname,
      ""
    );

    console.log("Rider created");
  }

  /**
   *
   * @param {string} id
   * @param {string} name
   * @param {{x:number, y:number}} position
   * @param {Genetic} brain
   */
  init(id, name, position, brain) {
    this.id = id;
    this.name = name;
    this.brain = brain;

    // Movement state
    this.position = position;
    this.src = new Position(position.x, position.y);
    this.trg = new Position(position.x, position.y);
    this.nextAction = null;
  }

  setConfig(config) {
    this.config = config;
    console.log("Config received: ", this.config);
  }

  updatePosition(x, y) {
    this.position.x = x;
    this.position.y = y;
  }

  isPathBlocked() {
    let blocked = false;
    for (const a of this.blocking_agents.values()) {
      if (a.x == this.trg.x && a.y == this.trg.y) {
        blocked = true;
        break;
      }
    }
    return blocked;
  }

  log(...args) {
    console.log("[", this.name, "] ", ...args);
  }
}
