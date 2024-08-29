import { onlineSolver } from "@unitn-asa/pddl-client";
import { Position } from "../data/position.js";
import { Action, ActionType } from "../data/action.js";
import { map } from "../master_agent.js";

// const pddlCache = new Map();

// function generateCacheKey(couples, obstacles) {
//   const couplesKey = couples.map(c => `${c.start.x},${c.start.y}-${c.end.x},${c.end.y}`).join('|');

//   let obstaclesKey = '';
//   if (Array.isArray(obstacles)) {
//     obstaclesKey = obstacles.map(o => `${o.x},${o.y}`).sort().join('|');
//   } else if (obstacles instanceof Map) {
//     obstaclesKey = Array.from(obstacles.values())
//       .map(o => `${o.x},${o.y}`)
//       .sort()
//       .join('|');
//   } else if (typeof obstacles === 'object' && obstacles !== null) {
//     obstaclesKey = Object.values(obstacles)
//       .map(o => `${o.x},${o.y}`)
//       .sort()
//       .join('|');
//   }

//   return `${couplesKey}#${obstaclesKey}`;
// }

export async function bfs_pddl(couplesInput, blocking_agents) {
  const couples = Array.isArray(couplesInput) ? couplesInput : [couplesInput];

  try {
    if (couples.length === 0) {
      console.error("No valid couples provided");
      return [];
    }

    // const cacheKey = generateCacheKey(couples, blocking_agents);

    // if (pddlCache.has(cacheKey)) {
    //   console.log("Cache hit!");
    //   return pddlCache.get(cacheKey);
    // }

    let initialState = [];
    let objectives = [];
    let agentObjects = [];

    couples.forEach((couple, index) => {
      if (!couple || !couple.start || !couple.end) {
        console.error("Invalid couple:", couple);
        return;
      }

      const { start, end, i, j } = couple;
      const startX = Math.round(start.x);
      const startY = Math.round(start.y);
      const endX = Math.round(end.x);
      const endY = Math.round(end.y);

      const agentName = `agent${index}`;
      agentObjects.push(`${agentName} - agent`);
      initialState.push(`(at ${agentName} t_${startX}_${startY})`);
      objectives.push(`(at ${agentName} t_${endX}_${endY})`);
    });

    for (let [belief, value] of map.beliefSet.entries) {
      if (value && belief.startsWith("connected")) {
        initialState.push(`(${belief})`);
      }
    }

    for (let agent of blocking_agents.values()) {
      if (
        agent &&
        typeof agent.x === "number" &&
        typeof agent.y === "number" &&
        !isNaN(agent.x) &&
        !isNaN(agent.y)
      ) {
        initialState.push(
          `(obstacle t_${Math.round(agent.x)}_${Math.round(agent.y)})`
        );
      }
    }

    let domainString = `
(define (domain multi-agent-BFS)
  (:requirements :strips :typing)
  (:types agent location)
  (:predicates
    (at ?a - agent ?pos - location)
    (connected ?from ?to - location)
    (obstacle ?pos - location)
  )
  (:action move
    :parameters (?a - agent ?from ?to - location)
    :precondition (and (at ?a ?from) (connected ?from ?to) (not (obstacle ?to)))
    :effect (and (not (at ?a ?from)) (at ?a ?to))
  )
)`;

    let problemString = `
(define (problem multi-agent-bfs-problem)
  (:domain multi-agent-BFS)
  (:objects
    ${agentObjects.join(" ")}
    ${map.beliefSet.objects.join(" ")} - location
  )
  (:init
    ${initialState.join("\n    ")}
  )
  (:goal (and
    ${objectives.join("\n    ")}
  ))
)`;

    let pddlResult = await onlineSolver(domainString, problemString);
    // console.log("PDDL result:", pddlResult);
    if (!pddlResult || !Array.isArray(pddlResult) || pddlResult.length === 0) {
      console.log("No valid paths found by PDDL solver");
      return couples.map(() => ({ path: -1 }));
    }

    let paths = couples.map((couple, index) => {
      let first_move = true;
      let path = [];
      let agentName = `AGENT${index}`;

      //console.log("processing agent", agentName, " ", couple);
      for (let action of pddlResult) {
        if (
          action &&
          action.action === "MOVE" &&
          action.args[0] === agentName
        ) {
          if (first_move) {
            first_move = false;
            let move = action.args[1];
            move = move.slice(2).replace("_", "-");
            path.push(move);
          }

          let move = action.args[2];
          move = move.slice(2).replace("_", "-");
          path.push(move);
        }
      }

      return {
        i: couple.i,
        j: couple.j,
        path: path.length > 0 ? path : -1,
      };
    });

    // pddlCache.set(cacheKey, paths);
    //console.log("PDDL paths:", paths);
    return paths;
  } catch (error) {
    console.error("Error in bfs_pddl:", error);
    return couples.map(() => ({ path: -1 }));
  }
}
