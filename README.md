# ASA_Glovojs

## TODO

- [x] Define interfaces
- [x] Implement actions data structure
- [x] Implement actions actuation
- [x] Implement dashboard
- [x] Implement planner
- [x] Improve reasoning to pick up multiple parcels instead of delivering asap
- [x] Stop going after parcels that have already been delivered
- [x] Anytime the agent steps on a parcel, pick it up
- [x] Anytime the agent steps on a delivery zone, deliver
- [x] (kinda) Prevent moving to unreachable tiles
- [x] Contain all planning inside the brain
- [x] Make sure planner doesnt miss new or previously discovered parcels
- [x] Planner must consider other agent's positions
- [x] Planner must make sure agent can get unstuck
- [x] Make sure planner doesnt forget he's carrying parcels when replanning
- [x] Double check for closest delivery point

- [x] Make sure agent knows how much (and how many parcels) he can carry when replanning
- [ ] Penaslize overly long paths
- [x] make sure agent forgets parcels left in memory when the tile comes back in view and the parcel is gone

- [ ] Make sure agent doesnt crash when NO plan is found (og no parcels, no delivery zones, no reachable tiles)

- [x] fix order of parcels in plan generation
- [x] reimplement agent blocking logic

- [ ] fix crossover for multiple agents
- [ ] make sure player_parcels are handled correctly in the planner
- [ ] make sure parcels are correctly memorized
- [ ] fix bfs crashing when position is not round
- [ ] rethink logic when it's time to replan (due to delivery or plan end)
- [ ] penalize too many plan changes
- [ ] check if carried parcels are correcly evaluated when replanning
