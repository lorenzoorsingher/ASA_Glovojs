import { onlineSolver } from "@unitn-asa/pddl-client";
import { Position } from "../data/position.js";
import { Action, ActionType } from "../data/action.js";
import { map } from "../master_agent.js";

export async function bfs_pddl(couplesInput, blocking_agents) {
  //   console.log("bfs_pddl called with input:", couplesInput);

  // Ensure couples is always an array
  const couples = Array.isArray(couplesInput) ? couplesInput : [couplesInput];

  try {
    if (couples.length === 0) {
      console.error("No valid couples provided");
      return [];
    }

    let initialState = [];
    let objectives = [];
    let agentObjects = [];

    // Process each couple
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

    // Add connected predicates from map.beliefSet
    for (let [belief, value] of map.beliefSet.entries) {
      if (value && belief.startsWith("connected")) {
        initialState.push(`(${belief})`);
      }
    }

    // Add blocking agents as obstacles
    for (let agent of blocking_agents) {
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

    // Construct the PDDL domain string
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

    // Construct the PDDL problem string
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

    // console.log("Domain:", domainString);
    // console.log("Problem:", problemString);

    // console.log("Calling PDDL solver...");
    let pddlResult = await onlineSolver(domainString, problemString);

    // console.log("PDDL solver returned:", pddlResult);

    if (!pddlResult || !Array.isArray(pddlResult) || pddlResult.length === 0) {
      console.log("No valid paths found by PDDL solver");
      return couples.map(() => ({ path: -1 }));
    }

    // Extract paths for each agent
    let paths = couples.map((couple, index) => {
      //let agentName = `agent${index}`;
      let path = [];
      let previousPosition = new Position(
        Math.round(couple.start.x),
        Math.round(couple.start.y)
      );
      let move = pddlResult[0].args[1];
      move = move.slice(2).replace("_", "-");
      path.push(move);
      for (let action of pddlResult) {
        if (
          action &&
          action.action === "MOVE" //&&
          //action.args[0] === agentName
        ) {
          //   console.log("PDDL action:", action);
          let [_, __, to] = action.args;
          let [prefix, x, y] = to.split("_");

          move = action.args[2];
          move = move.slice(2).replace("_", "-");
          path.push(move);
        } else {
          //   console.log("INVALID ACTION:", action);
        }
      }

      //   console.log("PDDL path: ", path);
      //   console.log("PDDL result:", {
      //     i: couple.i,
      //     j: couple.j,
      //     path: path.length > 0 ? path : -1,
      //   });

      return { i: couple.i, j: couple.j, path: path.length > 0 ? path : -1 };
    });

    // console.log("PDDL paths found:", paths);
    return paths;
  } catch (error) {
    console.error("Error in bfs_pddl:", error);
    return couples.map(() => ({ path: -1 }));
  }
}
