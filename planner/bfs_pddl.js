import { onlineSolver } from "@unitn-asa/pddl-client";
import { Position } from "../data/position.js";
import { Action, ActionType } from "../data/action.js";
import { map } from "../master_agent.js";

function buildPDDL(couples, blocking_agents) {
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

  return [domainString, problemString];
}

function couple_to_paths(couples, pddlResult) {
  let paths = couples.map((couple, index) => {
    let first_move = true;
    let path = [];
    let agentName = `AGENT${index}`;

    if (couple.start.equals(couple.end)) {
      path.push({
        i: couple.i,
        j: couple.j,
        path: Position.serialize(couple.start),
      });
    } else {
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
    }

    return {
      i: couple.i,
      j: couple.j,
      path: path.length > 0 ? path : -1,
    };
  });

  return paths;
}

function is_pddl_valid(pddlResult) {
  if (!pddlResult || !Array.isArray(pddlResult) || pddlResult.length === 0) {
    // console.log("No valid paths found by PDDL solver");
    return false;
  } else {
    return true;
  }
}

function build_failed_path(single_couple) {
  let couple = single_couple[0];
  return [
    {
      i: couple.i,
      j: couple.j,
      path: -1,
    },
  ];
}

export async function bfs_pddl(couplesInput, blocking_agents) {
  const couples = Array.isArray(couplesInput) ? couplesInput : [couplesInput];

  if (couples.length === 0) {
    console.error("No valid couples provided");
    return [];
  }

  let [domainString, problemString] = buildPDDL(couples, blocking_agents);

  let pddlResult = await onlineSolver(domainString, problemString);

  let paths = [];

  if (is_pddl_valid(pddlResult)) {
    console.log("[PDDL] Parallelization successful");
    paths = couple_to_paths(couples, pddlResult);
    // console.log("[PDDL] PDDL result:", pddlResult);
    // console.log("[PDDL] Paths found:", paths);
  } else {
    console.error("[PDDL] Parallelization failed, going to sequential");

    for (const couple of couples) {
      let single_couple = [couple];

      [domainString, problemString] = buildPDDL(single_couple, blocking_agents);
      pddlResult = await onlineSolver(domainString, problemString);
      if (is_pddl_valid(pddlResult)) {
        // console.log("[PDDL] Single solve successful");
        paths.concat(couple_to_paths(single_couple, pddlResult));
      } else {
        // console.error("[PDDL] Single solve failed");
        paths.concat(build_failed_path(single_couple));
      }
    }
  }

  return paths;
}
