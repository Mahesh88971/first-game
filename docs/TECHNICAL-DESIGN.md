# Technical design and delivery gates

## Runtime choice

The local Windows workspace has Node, Chrome and a cached Three.js distribution. A UE editor and toolchain were not found. The first playable therefore runs locally in WebGL 2 with a fixed-rate simulation and original procedural geometry. This makes a complete race testable here. UE5 remains the target for a production port with Chaos wheel contacts, authored assets and console instrumentation. The playable's route-relative chassis model intentionally assists heading through bends. It supports lateral slip, contact, airborne motion and fork choice within the drivable corridor.

## Ownership and folder structure

| Location | Responsibility |
| --- | --- |
| index.html, styles.css | Accessible hub, garage, settings, race HUD and overlays |
| src/config.js | Vehicle, sector, surface, personality and ability data |
| src/track.js | Arc-length sampling, road frames, elevation, branches and checkpoint gates |
| src/vehicle.js | Fixed-step traction, suspension, lateral and longitudinal motion |
| src/race.js | Grid, ordering, AI input, contact events, pickups, laps, weather and finish |
| src/world.js, src/models.js | Three.js scene, terrain, route furniture, vehicle geometry and effects |
| src/audio.js | Synthesized engine, gear changes, surface and transient sounds |
| src/profile.js | Versioned local profile, settings, tune purchase and results |
| src/main.js | Screen state, input, camera selection, simulation clock and UI binding |
| assets | Original race artwork, garage photography and horizon |
| build | Locally bundled executable browser code |
| tests | Deterministic race, handling and progression checks |

The renderer consumes vehicle poses and event notifications. Input produces throttle, brake, steer, drift, boost and use actions. A 60 Hz accumulator steps the simulation independently from drawing. Timers use simulated race time, pause suspends integration, and page visibility changes pause a live event. The profile only grants a race purse once per finished run.

## Vehicle physics and presentation

Power, torque, mass and speed limits determine propulsion. Tire grip, surface resistance and wetness modify slip and drag. Steering is filtered and road curvature contributes a lateral load. A damped lateral velocity and yaw target supply countersteer and stability assistance. Front and rear contact samples on both sides drive spring compression and body pitch/roll. A ballistic vertical state handles the cliff jump. Landing alignment gates a boost bonus. Mass, impact speed and obstacle type determine damage and retained momentum.

The chase target follows the chassis with exponential damping, a lead point and capped high-speed FOV expansion. Close chase and hood positions share the same vehicle frame. Rain, tire spray, marks, lighting and engine pitch read the simulation's current state. Trackside view follows the live car from successive fixed viewpoints. Results hold the classification at the player's finish.

## Track, AI and race validation

The course is a closed Catmull–Rom spline sampled into an arc-length table and rescaled to 6,400 m. A distance lookup gives position, tangent, lateral axis, altitude and curvature. Shortcuts have separate sampled centre lines and physical lengths. Each maps its own distance back to equivalent main-route progress for ranking. Their entry gates use a side of the road. Road width and surface are data-driven by sector. Checkpoints advance in order. The finish accepts the third complete set of gates. Finisher order is locked, and remaining drivers are explicitly classified as still racing.

AI produces the same input contract as the player. Its planner reads a bounded look-ahead, selects a lane, checks nearby traffic, and brakes against a surface- and curvature-dependent target speed. Personality weights set overtaking margin, shortcut preference and ability usage. Pickups, collision cooldowns, damage and boost energy belong to individual entrants. Weather is a continuous function of the coast sector and race clock.

## UE5 production responsibilities

| Domain | C++ ownership | Blueprint, Data Asset and editor ownership |
| --- | --- | --- |
| Chassis | Vehicle pawn, Chaos movement adapter, replicated input, contact samples, damage and ability components | Skeletal chassis, wheel rigs, physical materials, tuning assets and damage variants |
| Competition | Race GameMode, GameState, ordered gates, authoritative finish and replay stream | Start grid, timing volumes, route spline actors and event sequences |
| AI | Perception budget, racing-line sample cache and inputs through the same controller | Personality assets, service intervals and behaviour tree decisions |
| Environment | Weather clock, surface state and streamed sector registry | World Partition cells, Nanite cliffs, Lumen lighting, Niagara spray and material instances |
| Front end | SaveGame migration, career grants, async loading and input mapping | UMG screens, Enhanced Input contexts, camera curves, MetaSounds graphs and accessibility options |

A future dedicated server owns race start time, ordered route gates, item grants and finish order for 8–12 entrants. Clients submit sequenced inputs. The server validates rate, route continuity, collisions and ability cooldowns, publishes corrected snapshots, and stores accepted timing traces for ghosts. Private lobbies, matchmaking, friends and rankings require authenticated backend services. They are production work beyond this local race.

## Performance and release gates

Target 16.7 ms frames on specified recommended PC hardware. Reserve approximately 3 ms for simulation/AI, 4 ms for scene submission and 9 ms for the GPU, then measure on reference hardware. Merge repeated static geometry by spatial chunk and material, cull distant sectors, bound effects and cap pixel ratio by preset. Keep timing and race rules identical across presets. Debug output should expose FPS, calls, contacts, surface, wheel response, boost, damage and route gates. Hardware certification requires timed captures during the wet start, packed bridge and storm landing.

| Gate | Objective and acceptance |
| --- | --- |
| Architecture | Load tune and course data without a renderer, validate course continuity |
| Handling and camera | Launch each chassis, brake, hold a slide, recover on sand, check damping at low frame rate |
| Track and race | Traverse all sectors and both alternate paths, pass gates in order, finish three laps |
| Competition | Run nine cars through a full seeded event and verify stable finish order |
| Abilities and interaction | Exercise shield, repair, pulse, boost, breakage, impacts, jump and landing |
| Weather, VFX and damage | Confirm wet grip, spray, visible damage and gradual weather in a race |
| UI, garage and audio | Verify controls, pause, spending, persistence, rematch and audio unlock |
| Optimization and polish | Render the normal entry point, inspect race footage, record budgets and remaining risks |
