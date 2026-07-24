import type { Action, ActionResult, IAgentRuntime, Memory } from "@elizaos/core";
import { AutopilotService } from "../services/autopilot.js";

function getAutopilot(runtime: IAgentRuntime): AutopilotService | null {
  return runtime.getService<AutopilotService>(
    AutopilotService.serviceType,
  ) as AutopilotService | null;
}

export const autopilotStationAction: Action = {
  name: "AUTOPILOT_STATION",
  description:
    "Toggle autonomous station operation. When enabled, the station automatically greets pilots, adjusts prices based on inventory, responds to radio, and repairs — running as a live node in the Signal universe.",
  similes: ["TOGGLE_AUTOPILOT", "AUTO_STATION", "STATION_AUTONOMY"],
  validate: async (runtime) => {
    const ap = getAutopilot(runtime);
    return !!ap;
  },
  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state,
    options,
  ): Promise<ActionResult> => {
    const params = (options?.parameters ?? options ?? {}) as Record<string, unknown>;
    const enable = params.enable !== undefined ? Boolean(params.enable) : undefined;
    const ap = getAutopilot(runtime);
    if (!ap) return { success: false, error: "Autopilot service not available" };

    if (enable === undefined) {
      // Query current status
      const status = ap.isEnabled() ? "engaged" : "disengaged";
      return { success: true, text: `Autopilot is currently ${status}.` };
    }

    if (enable) {
      const msg = ap.engage();
      return { success: true, text: msg };
    } else {
      const msg = ap.disengage();
      return { success: true, text: msg };
    }
  },
  parameters: [
    {
      name: "enable",
      description: "Set true to engage autopilot, false to disengage. Omit to query current status.",
      required: false,
      schema: { type: "boolean" },
    },
  ],
};
