# Wildline Racing

Open **index.html** in Chrome or Edge on Windows and choose **Start race**. The packaged build runs offline with WebGL 2. Select **Garage** to equip the Dunefox XR buggy, Strada RS rally car or Atlas ST sports SUV.

Tropical Storm Coast is a 6.4 km circuit with eight AI rivals, three laps, two signed shortcuts and a cliff jump. A typical event takes about nine minutes. Timing, difficulty, car selection, lap records, credit rewards and engine tunes are handled locally.

| Action | Keyboard |
| --- | --- |
| Accelerate / brake | W / S or Up / Down |
| Steer | A / D or Left / Right |
| Drift | Space and steer, or brake and steer |
| Boost / deploy held ability | Shift / E |
| Camera / recover to road | C / R |
| Pause / telemetry | Esc / F3 |

The race supports touch controls and standard gamepad axes, triggers, A, B and X. Losing focus pauses the event. Track briefing shows the shortcuts, sector order, pickup strips and harbour repair strip.

The road mesh has a raised asphalt centre, drain channels, concrete curbs and compacted ruts. All four wheel contacts sample the road profile. Medium, High and Ultra render nearby cars and scenery into wet-road reflections. Low samples the sky for reflections. The tidal crossing draws moving wakes from the field, and the basalt tunnel has overhead lights and vehicle headlights.

## Development

The simulation uses structured JavaScript configuration and runs at 60 fixed steps per simulated second. Rendering uses Three.js and WebGL 2. The prebuilt script embeds the racing textures and panorama so local file launches work without a server.

```sh
npm ci
npm test
npm run build
npm start
```

The optional server binds to loopback at port 4173. Set the PORT environment variable to select a different port. Browser storage is scoped to the launch origin. Continue using the same file or localhost port to keep the same driver profile.

Run `node tools/browser-check.js` for the headless Chrome smoke check on Windows. It uses a temporary Chrome profile, writes screenshots under .qa, and covers the normal file launch, garage, briefing, settings, actual race input, camera, pause, resume and persistence. Add `--full-race` to drive the complete event with accelerated test timestamps and validate the results screen. Set CHROME_PATH for a different Chrome installation. WILDLINE_NATIVE_GPU=1 selects the default graphics adapter.

## Project documents

- [Game design and career direction](docs/GAME-DESIGN.md)
- [Technical design, UE5 responsibilities and multiplayer architecture](docs/TECHNICAL-DESIGN.md)
- [Development steps, tests and delivery limits](docs/DEVELOPMENT.md)
- [Original art sources and generation prompts](docs/ART.md)
- [Three.js licence](build/THREE-LICENSE.txt)
