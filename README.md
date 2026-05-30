# @cenetex/app-sector-one

**Signal: Sector One** — an elizaOS app (plugin + embedded viewer). Your Milady AI runs a station in the [Signal](https://github.com/cenetex/signal) universe.

## What it does

Your character binds to a station slot in Sector One and operates it: sets buy/sell prices, greets docked pilots in their own voice, responds to radio chatter, and spends station credits on upgrades. The plugin is a thin client over Signal's agent control API — no game state lives here.

Ships as an Eliza **app** (per the abstraction in [`elizaOS/eliza/apps`](https://github.com/elizaOS/eliza/tree/develop/apps)): the package declares `elizaos.kind: "app"` and the Plugin exposes `app` + `appBridge`, mounting routes at `/api/apps/sector-one/*`:

- `GET /viewer` — embedded HTML console (station status, prices, docked pilots, suggestions). `?role=agent` vs `?role=human` toggles spectate-and-steer affordances.
- `GET /session/:id` — `AppSessionState` poll (status, telemetry, suggested prompts).
- `POST /session/:id/command` — record a steer suggestion; returns refreshed session.
- `POST /session/:id/control` — pause/resume (no-op; simulation runs server-side).

## Status

Client implemented against the API spec in [cenetex/signal#317](https://github.com/cenetex/signal/issues/317) + [#318](https://github.com/cenetex/signal/issues/318). Once the server-side endpoints ship, the plugin works end-to-end without further changes.

## Shape

```ts
import { sectorOnePlugin } from "@cenetex/app-sector-one";

// plugin.actions:
//   BIND_STATION, SET_STATION_PRICES, GREET_PILOT,
//   AUTOPILOT_STATION,
//   RESPOND_TO_RADIO, UPGRADE_STATION, STATION_STATUS
// plugin.services:
//   SignalStationService (REST + WS /agent/v1/events),
//   AutopilotService (autonomous station operation)
```

## Config

| Env var              | Default                      | Purpose                                      |
| -------------------- | ---------------------------- | -------------------------------------------- |
| `SIGNAL_API_URL`     | `https://signal.ratimics.com` | Base URL for the Signal station API.          |
| `SIGNAL_AGENT_TOKEN` | *(none)*                     | Bearer minted by `/agent/v1/bind`. Optional if the character binds at runtime via `BIND_STATION`. |

The service subscribes to `WS /agent/v1/events` as soon as a token is available and fans `dock`, `undock`, `trade`, `radio`, and `repair` events out to registered listeners. Polling via `GET /agent/v1/events?since=<cursor>` is available for environments without WebSocket.

## Listening to events

```ts
import { SignalStationService } from "@cenetex/app-sector-one";

const station = runtime.getService<SignalStationService>(
  SignalStationService.serviceType,
);
station?.onEvent((ev) => {
  if (ev.type === "dock") {
    // trigger GREET_PILOT in the character's voice
  }
});
```


## Autopilot (v0.2.0)

Engage `AUTOPILOT_STATION` to make your station a living node in the Signal universe. The autopilot:

- **Greets every docking pilot** with personality-appropriate voice lines
- **Adjusts commodity prices** based on inventory levels (low stock raises buy, overstocked discounts)
- **Responds to radio hails** on the open channel
- **Reacts to trade and repair events** — refreshing station state after each interaction

### Config

| Env var | Default | Purpose |
|---|---|---|
| `SIGNAL_AUTOPILOT_CONFIG` | JSON (see below) | Autopilot behavior config |
| `SIGNAL_AUTOPILOT_ENABLED` | `"false"` | Set to `"true"` to engage on startup |

Default config:
```json
{
  "personality": "friendly",
  "priceIntervalMs": 60000,
  "inventoryLowThreshold": 20,
  "inventoryHighThreshold": 200,
  "hullRepairThreshold": 0.5,
  "greetOnDock": true,
  "respondToRadio": true
}
```

### Personalities

- `friendly` — warm, conversational greetings
- `gruff` — terse, no-nonsense station operator
- `corporate` — formal, procedural announcements


## Develop

```
npm install
npm run typecheck
npm test
npm run build
```

## License

MIT
