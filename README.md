# GlovoJS

<p align="center">
<img src="images/logojs.png" style="display:block;float:none;margin-left:auto;margin-right:auto;width:40%"/>
</p>

## Authors

- [@lorenzoorsingher](https://github.com/lorenzoorsingher)
- [@Edomenegaz](https://github.com/Edomenegaz)
- [GitHub repo](https://github.com/lorenzoorsingher/ASA_Glovojs)

## What is GlovoJS?

[Deliveroo.js](https://github.com/unitn-ASA/Deliveroo.js) is an educational game developed for the course of Automonous Software Agents at the University of Trento. The game is a simplified version of Deliveroo's delivery system where agents must pick up parcels and deliver them to the correct delivery zones. The game is played on a grid where agents can move in the four cardinal directions and pick up and carry multiple parcels.

**GlovoJS** is a system that allows to run simultaneously multiple agents with an optimized algorithm that creates the best delivery strategy to maximize the number of delivered parcels, even in the presence of antagonistic agents. For more detailed information about the system you can check the report below.

| <a href="https://github.com/lorenzoorsingher/ASA_Glovojs/blob/main/ASA_2024___Glovo_JS.pdf"><img src="images/report_front.png" width="300"/></a> |
| :----------------------------------------------------------------------------------------------------------------------------------------------: |
|                                                             Click to download report                                                             |

## Project Structure

```
GlovoJS
├── configs
│   ├── allbfs.json
│   ├── allpddl.json
│   ├── boostpddl.json
│   ├── gigabfs.json
│   ├── stubborn.json
│   └── superbfs.json
├── custom
│   ├── online_solver_bkp.js
│   └── online_solver_custom.js
├── dashboard
│   ├── dashboard.css
│   ├── multi_dashboard.html
│   └── server.js
├── data
│   ├── action.js
│   ├── field.js
│   ├── position.js
│   └── tile.js
├── images
│   └── ...
├── planner
│   ├── bfs_pddl.js
│   └── plan_cacher.js
├── agent.js
├── geneticBrain.js
├── index.js
├── package.json
├── package-lock.json
├── README.md
├── rider.js
└── utils.js
```

## Implementation

The system is implemented in JavaScript via Node.js, each component is implemented as a class and the main loop is implemented in agent.js, which is the entry point of the system. The main components are:

- **Agent** - this class contains all the sensing function that interact with the server and the game state, it also contains the main loop that is used to run the agents and consume the actions generated by the planner.

- **Rider** - this class represent the agent that moves on the grid and picks up and delivers parcels, each rider contains all the information about its game state.

- **Genetic** - this class is used to implement the genetic algorithm that is used to optimize the delivery strategy of the agents. All the riders are dependent on this class as it is used to generate the best cooperative plan for each and every rider.

- **Field** - this class represents the game field, it contains all the information about the parcels, delivery zones and spawn zones which is used to generate the graph that is used by the genetic algorithm.

- **Dashboard** - the dashboard offers a real time visualization of the game state and the agents' actions. Thanks so this tool it's possible to visualize not only the agent's actual percept but also the plans that the agents are following, great for debug.

- **Planner** - this class is used to interface with the PDDL solver and to generate the plans for the agents. It contains all the logic translate a request into a PDDL problem and parsing the result

Some additional components are present to have handy representations of actions, positions and other data structures.

## Usage

To run the system you need to have Node.js installed on your machine as well as all the dependencies for the project. To install the dependencies you can run:

```bash
npm install
```

After that you can run the system with:

```bash
npm start
```

You can provide some parameters to change the configuration of the system, to specify the parameters you want to change you can provide them in the command line. The parameters are:

- **USE_PDDL** - if true the system will use the PDDL solver to generate the plans
- **BOOST** - if true the system will use the boosted BFS to populate the cache before the game starts
- **BLOCKING_DISTANCE** - define maximum distance to consider other agents blocking the way (lower is faster)
- **PRC_OBS** - define maximum distance to consider parcels in the agent's percept (lower is faster)
- **CLS_DLV** - define the number of delivery zones considered in the graph building (lower is faster)
- **CLS_PAR** - define the number of parcels considered in the graph building (lower is faster)
- **NRIDERS** - define the size of the agent fleet
- **POP** - define the size of the population for the genetic algorithm
- **GEN** - define the number of generations for the genetic algorithm
- **PORT** - define the port for the dashboard
- **PREFIX** - define the prefix for the agent name

You can run the system with the default parameters or you can change them to test different configurations, for example this command will run the system with 3 agents and a population of 100 for 50 generations:

```bash
npm start NRIDERS 3 POP 100 GEN 50
```

Alternatively you can run the system with a predefined configuration by using the configuration files in the `configs` folder or you can make a custom one:

```json
{
  "USE_PDDL": false,
  "BOOST": false,
  "BLOCKING_DISTANCE": 3,
  "CLS_DLV": 10000,
  "CLS_PAR": 10000,
  "NRIDERS": 1,
  "POP": 100,
  "GEN": 30,
  "PORT": 3004,
  "PREFIX": "SUPERBFS",
  "PRC_OBS": 1000
}
```

```bash
npm start configs/superbfs.json
```

## Dockerized Solver

To use the dockerize version of the PDDL planner you will need to get the image for [Planutils](https://github.com/AI-Planning/planutils/tree/main/environments/server) (follow the instructions in the README) and it's necessary so replace the content of the file `PddlOnlineSolver.js` with the content of the file `custom/online_solver_custom.js` in order to connect to the local server.

## Dashboard

In case you want to run multiple separate instances of GolovoJS on the same machine you may need to change the port in order to access the different dashboards. By the default the port is 3000 and the address is `http://localhost:3000`.

<img src="images/dash.png"  width="400"/>

Each agent and their respective plans are represented by a different color (3 in this case: pink, blue, gray), enemy agents are represented by a purple tiles.

Numbered tiles represent free parcels, the number is the current score of the parcel, when the parcel tile is highlighted in light green it means that an agent is going to pick it up, if that's not the case the tile is highlighted in yellow.

Delivery zones are represented by red tiles, if a delivery is planned the tile will be highlighted in orange.

Below the grid there is a synthetic summary of the parcels currently being carried by the agents, complete of current score and parcel id.

## Features

- **Genetic Algorithm** - the system uses a **genetic algorithm** to optimize the delivery strategy of the agents. The objective of the algorithm is to maximize the fitness of a plan, the fitness is computed weighting the parcels to be delivered and the distance traveled.

  One interesting feature is that to change the behavior of the agents it's sufficient to tune the parameters inside the fitness function, giving more importance to the distance traveled, the parcels delivered, the frequency of delivery and so on. It's also _trivially easy_ to add new parameters as the fitness function itself is a simple function that takes a plan and returns a number.

- **Real Time Dashboard** - the system offers a real time dashboard that allows to visualize the game state and the agents' plans. The dashboard is useful to debug the system and to understand the behavior of the agents.

- **Multiple Agents** - the system can run an **arbitrary number of agents** simultaneously, each agent is independent of the others and has its own plan and strategy computed by the genetic algorithm. The complexity of the system grows linearly with the number of agents as the genetic algorithm has a fixed population/generation size and the pathfinding is computed for each agent.

- **Optimized Pathfinding** - the system uses a Breadth First Search algorithm to compute the shortest path between two points on the grid. However, the BFS is optimized to avoid recomputing the path for the same points, this is done by **caching the results of the BFS** and reusing them when needed this means that the performance actually increases as teh game progresses and the agents move around the grid.

- **Parallelized Pathfinding** - the PDDL planner is parallelized to compute the shortest path between tiles in parallel.
