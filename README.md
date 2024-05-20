# ASA_Glovojs


## TODO

- [x] Define interfaces
- [x] Implement actions data structure
- [x] Implement actions actuation
- [x] Implement dashboard
- [x] Implement planner
- [x] Improve reasoning to pick up multiple parcels instead of delivering asap
- [X] Stop going after parcels that have already been delivered
- [x] Anytime the agent steps on a parcel, pick it up
- [x] Anytime the agent steps on a delivery zone, deliver
- [/](kinda) Prevent moving to unreachable tiles
- [x] Contain all planning inside the brain
- [x] Make sure planner doesnt miss new or previously discovered parcels
- [x] Planner must consider other agent's positions
- [x] Planner must make sure agent can get unstuck
- [x] Make sure planner doesnt forget he's carrying parcels when replanning
- [x] Double check for closest delivery point
- [ ] Make sure agent knows how much (and how many parcels) he can carry when replanning
- [ ] Penalize overly long paths
- [ ] Deliver when there's no time left
- [ ] Every time the agent steps on a parcel, they should add it to the plan and pick it up
- [ ] For every pacel, check that it's actually carried by the agent to prevent phantom carried parcels
- [ ] Be more insistent when blocked by another agent, assuming they will eventually give up and replan