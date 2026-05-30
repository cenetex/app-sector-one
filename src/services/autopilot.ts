import { Service, type IAgentRuntime } from "@elizaos/core";
import { SignalStationService } from "./station-service.js";
import type { StationEvent, StationState } from "../types.js";

/** Configuration knobs for autonomous station behavior. */
interface AutopilotConfig {
  /** How often (ms) to re-evaluate pricing. */
  priceIntervalMs: number;
  /** Low inventory threshold — trigger a discount if any commodity drops below this. */
  inventoryLowThreshold: number;
  /** High inventory threshold — raise prices if any commodity exceeds this. */
  inventoryHighThreshold: number;
  /** Hull percentage below which auto-repair is triggered. */
  hullRepairThreshold: number;
  /** Whether to auto-greet every docking pilot. */
  greetOnDock: boolean;
  /** Whether to auto-respond to radio hails. */
  respondToRadio: boolean;
  /** Personality seed for voice line generation. */
  personality: string;
}

const DEFAULT_CONFIG: AutopilotConfig = {
  priceIntervalMs: 60_000,
  inventoryLowThreshold: 20,
  inventoryHighThreshold: 200,
  hullRepairThreshold: 0.5,
  greetOnDock: true,
  respondToRadio: true,
  personality: "friendly",
};

/**
 * AutopilotService — makes a station feel alive.
 *
 * Listens to station events and autonomously:
 *   - Greets every docking pilot with a personality-appropriate line
 *   - Adjusts commodity prices based on inventory levels
 *   - Responds to radio hails
 *   - Repairs when hull is damaged
 *
 * This is what "running a node" means — the station operates itself,
 * with the agent providing strategic oversight rather than micro-management.
 */
export class AutopilotService extends Service {
  static serviceType = "sector-one-autopilot";
  capabilityDescription =
    "Autonomous station operator — greets pilots, adjusts prices, reacts to events.";

  private runtime: IAgentRuntime | null = null;
  private stationSvc: SignalStationService | null = null;
  private config: AutopilotConfig = { ...DEFAULT_CONFIG };
  private enabled = false;
  private priceTimer: ReturnType<typeof setInterval> | undefined;
  private unsubscribe: (() => void) | undefined;
  private lastStationState: StationState | null = null;

  async initialize(runtime: IAgentRuntime): Promise<void> {
    this.runtime = runtime;
    this.stationSvc = runtime.getService<SignalStationService>(
      SignalStationService.serviceType,
    ) as SignalStationService | null;
    this.loadConfig(runtime);
  }

  private loadConfig(runtime: IAgentRuntime): void {
    const raw = runtime.getSetting("SIGNAL_AUTOPILOT_CONFIG");
    if (raw && typeof raw === "string") {
      try {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      } catch {
        console.warn("[autopilot] failed to parse SIGNAL_AUTOPILOT_CONFIG, using defaults");
      }
    }
  }

  /** Start autonomous operation. */
  start(): string {
    if (this.enabled) return "Autopilot is already running.";

    if (!this.stationSvc) {
      return "Cannot start autopilot — station service not available. Bind a station first.";
    }

    this.enabled = true;

    // Subscribe to station events
    this.unsubscribe = this.stationSvc.onEvent((event: StationEvent) => {
      this.handleEvent(event).catch((err) =>
        console.warn("[autopilot] event handler error:", err),
      );
    });

    // Periodic price re-evaluation
    this.priceTimer = setInterval(() => {
      this.evaluatePrices().catch((err) =>
        console.warn("[autopilot] price eval error:", err),
      );
    }, this.config.priceIntervalMs);

    // Initial state fetch
    this.fetchState().catch((err) =>
      console.warn("[autopilot] initial state fetch error:", err),
    );

    console.log("[autopilot] started — station is now autonomous");
    return "Autopilot engaged. Station is now operating autonomously.";
  }

  /** Stop autonomous operation. */
  stop(): string {
    this.enabled = false;
    if (this.priceTimer) clearInterval(this.priceTimer);
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    console.log("[autopilot] stopped");
    return "Autopilot disengaged. Manual control resumed.";
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private async handleEvent(event: StationEvent): Promise<void> {
    if (!this.enabled || !this.stationSvc) return;

    switch (event.type) {
      case "dock":
        if (this.config.greetOnDock) {
          const line = this.generateGreeting(event.pilot.handle, event.pilot.ship_class);
          await this.stationSvc.sendVoice({ channel: "dock", pilot_handle: event.pilot.handle, line });
          console.log(`[autopilot] greeted ${event.pilot.handle} (${event.pilot.ship_class})`);
        }
        // Refresh state after dock (inventory may have changed via trade)
        await this.fetchState();
        break;

      case "trade":
        console.log(
          `[autopilot] trade: ${event.pilot_handle} ${event.side}s ${event.quantity} ${event.commodity} for ${event.credits_delta} credits`,
        );
        await this.fetchState();
        break;

      case "radio":
        if (this.config.respondToRadio) {
          const line = this.generateRadioReply(event.pilot_handle, event.line);
          await this.stationSvc.sendVoice({ channel: "radio", pilot_handle: event.pilot_handle, line });
          console.log(`[autopilot] replied to radio from ${event.pilot_handle}`);
        }
        break;

      case "repair":
        console.log(`[autopilot] repair: ${event.pilot_handle} repaired ${event.hull_repaired} hull for ${event.cost} credits`);
        await this.fetchState();
        break;

      case "undock":
        console.log(`[autopilot] ${event.pilot_handle} undocked`);
        break;
    }
  }

  private generateGreeting(handle: string, shipClass: string): string {
    const greetings: Record<string, string[]> = {
      friendly: [
        `Welcome to dock, ${handle}! Smooth flight out there?`,
        `${handle}, good to see you. Your ${shipClass} is looking sharp.`,
        `Docking clamp secure, ${handle}. What can we do for you today?`,
      ],
      gruff: [
        `${handle}. Keep it quick.`,
        `Another ${shipClass}. Fine. What do you need?`,
        `Dock and trade, ${handle}. We don't do charity.`,
      ],
      corporate: [
        `Docking sequence complete. Welcome, pilot ${handle}. Station services are available.`,
        `${handle}, your ${shipClass} has been logged. Please review our current commodity prices.`,
      ],
    };

    const pool = greetings[this.config.personality] ?? greetings.friendly;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private generateRadioReply(handle: string, _line: string): string {
    const replies: Record<string, string[]> = {
      friendly: [
        `Copy that, ${handle}. We read you.`,
        `Loud and clear, ${handle}. What's your status?`,
        `Roger, ${handle}. Transmitting station data now.`,
      ],
      gruff: [
        `Heard.`,
        `${handle}, make it fast.`,
        `What?`,
      ],
      corporate: [
        `Acknowledged, ${handle}. Stand by for telemetry.`,
        `Signal received. Transmitting station beacon.`,
      ],
    };

    const pool = replies[this.config.personality] ?? replies.friendly;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private async evaluatePrices(): Promise<void> {
    if (!this.enabled || !this.stationSvc || !this.lastStationState) return;

    const state = this.lastStationState;
    const adjustments: { commodity: string; buy: number; sell: number }[] = [];

    for (const item of state.inventory) {
      const currentPrice = state.prices.find((p) => p.commodity === item.commodity);
      if (!currentPrice) continue;

      let { buy, sell } = currentPrice;

      if (item.quantity < this.config.inventoryLowThreshold) {
        // Low stock — raise buy price to attract sellers, raise sell price
        buy = Math.round(buy * 1.2);
        sell = Math.round(sell * 1.1);
      } else if (item.quantity > this.config.inventoryHighThreshold) {
        // Overstocked — lower buy price, discount sales
        buy = Math.round(buy * 0.8);
        sell = Math.round(sell * 0.9);
      }

      if (buy !== currentPrice.buy || sell !== currentPrice.sell) {
        adjustments.push({ commodity: item.commodity, buy, sell });
      }
    }

    if (adjustments.length > 0) {
      const prices = state.prices.map((p) => {
        const adj = adjustments.find((a) => a.commodity === p.commodity);
        return adj ? { commodity: p.commodity, buy: adj.buy, sell: adj.sell } : p;
      });

      try {
        await this.stationSvc.setPrices({ prices });
        console.log(`[autopilot] adjusted prices for ${adjustments.map((a) => `${a.commodity}`).join(", ")}`);
      } catch (err) {
        console.warn("[autopilot] price adjustment failed:", err);
      }
    }
  }

  private async fetchState(): Promise<void> {
    if (!this.stationSvc) return;
    try {
      this.lastStationState = await this.stationSvc.getStation();
    } catch (err) {
      console.warn("[autopilot] state fetch failed:", err);
    }
  }
}
