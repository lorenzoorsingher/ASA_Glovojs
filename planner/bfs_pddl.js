import { onlineSolver } from "@unitn-asa/pddl-client";
import { Position } from "../data/position.js";
import { map } from "../master_agent.js";

export async function bfs_pddl(start, end, blocking_agents) {
    console.log("bfs_pddl called with start:", start, "end:", end);
    
    try {
        const startX = Math.round(start.x);
        const startY = Math.round(start.y);
        const endX = Math.round(end.x);
        const endY = Math.round(end.y);

        console.log("Rounded coordinates:", { startX, startY, endX, endY });

        let initialState = [];
        initialState.push(`(at t_${startX}_${startY})`);

        for (let [belief, value] of map.beliefSet.entries) {
            if (value && belief.startsWith('connected')) {
                initialState.push(`(${belief})`);
            }
        }

        for (let agent of blocking_agents) {
            initialState.push(`(obstacle t_${agent.x}_${agent.y})`);
        }

        let objective_str = `(at t_${endX}_${endY})`;

        let domainString = `\
(define (domain BFS)
  (:requirements :strips)
  (:predicates
    (at ?pos)
    (connected ?from ?to)
    (obstacle ?pos)
  )
  (:action move
    :parameters (?from ?to)
    :precondition (and (at ?from) (connected ?from ?to) (not (obstacle ?to)))
    :effect (and (not (at ?from)) (at ?to))
  )
)`;

        let problemString = `\
(define (problem bfs-problem)
  (:domain BFS)
  (:objects ${map.beliefSet.objects.join(' ')})
  (:init ${initialState.join(' ')})
  (:goal ${objective_str})
)`;

        console.log("Domain:", domainString);
        console.log("Problem:", problemString);
        
        console.log("Calling PDDL solver...");
        let pddlResult;
        try {
            pddlResult = await onlineSolver(domainString, problemString);
        } catch (solverError) {
            console.error("Error from PDDL solver:", solverError);
            return -1;
        }

        console.log("PDDL solver returned:", pddlResult);

        if (!pddlResult || !Array.isArray(pddlResult) || pddlResult.length === 0) {
            console.log("No valid path found by PDDL solver");
            return -1;
        }

        let path = [`${start.x}-${start.y}`];
        for (let action of pddlResult) {
            if (action && typeof action.action === 'string' && Array.isArray(action.args) && action.args.length >= 2) {
                let [_, to] = action.args;
                if (typeof to === 'string') {
                    let [prefix, x, y] = to.split('_');
                    if (x && y) {
                        path.push(`${x}-${y}`);
                    }
                }
            }
        }

        console.log("PDDL path found:", path);
        return path;
    } catch (error) {
        console.error("Error in bfs_pddl:", error);
        return -1;
    }
}