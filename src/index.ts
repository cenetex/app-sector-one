import type { Plugin } from "@elizaos/core";
import { SignalStationService } from "./services/station-service.js";
import { AutopilotService } from "./services/autopilot.js";
import { bindStationAction } from "./actions/bind-station.js";
import { setPricesAction } from "./actions/set-prices.js";
import { greetPilotAction } from "./actions/greet-pilot.js";
import { respondToRadioAction } from "./actions/respond-to-radio.js";
import { upgradeStationAction } from "./actions/upgrade-station.js";
import { stationStatusAction } from "./actions/station-status.js";
import { autopilotStationAction } from "./actions/autopilot-station.js";
import {
  collectLaunchDiagnostics,
  handleAppRoutes,
  refreshRunSession,
  resolveLaunchSession,
  type RouteContext,
} from "./routes.js";

export const sectorOnePlugin: Plugin = {
  name: "sector-one",
  description:
    "Signal: Sector One — run a station. Your Milady AI operates a refinery, yard, or works in the Signal universe. Engage autopilot to make your station a living node.",
  services: [SignalStationService, AutopilotService],
  actions: [
    bindStationAction,
    setPricesAction,
    greetPilotAction,
    respondToRadioAction,
    upgradeStationAction,
    stationStatusAction,
    autopilotStationAction,
  ],
  app: {
    displayName: "Signal: Sector One",
    category: "game",
    launchType: "connect",
    launchUrl: null,
    capabilities: [
      "game",
      "station-control",
      "voice",
      "trading",
      "autopilot",
      "spectate-and-steer",
    ],
    runtimePlugin: "@cenetex/app-sector-one",
    viewer: {
      url: "/api/apps/sector-one/viewer",
      sandbox: "allow-scripts allow-same-origin allow-popups allow-forms",
    },
    session: {
      mode: "spectate-and-steer",
      features: ["commands", "telemetry", "suggestions"],
    },
  },
  appBridge: {
    handleAppRoutes: (ctx: unknown) => handleAppRoutes(ctx as RouteContext),
    resolveLaunchSession,
    refreshRunSession,
    collectLaunchDiagnostics,
  },
};

export default sectorOnePlugin;

export { SignalStationService } from "./services/station-service.js";
export { AutopilotService } from "./services/autopilot.js";
export { bindStationAction } from "./actions/bind-station.js";
export { setPricesAction } from "./actions/set-prices.js";
export { greetPilotAction } from "./actions/greet-pilot.js";
export { respondToRadioAction } from "./actions/respond-to-radio.js";
export { upgradeStationAction } from "./actions/upgrade-station.js";
export { stationStatusAction } from "./actions/station-status.js";
export { autopilotStationAction } from "./actions/autopilot-station.js";
export {
  collectLaunchDiagnostics,
  handleAppRoutes,
  refreshRunSession,
  resolveLaunchSession,
} from "./routes.js";
export { renderViewerHtml, VIEWER_FRAME_ANCESTORS_DIRECTIVE } from "./viewer.js";
export * from "./types.js";
