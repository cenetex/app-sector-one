import type { IAgentRuntime, Service } from "@elizaos/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutopilotService } from "../services/autopilot.js";
import { SignalStationService } from "../services/station-service.js";
import type { StationState } from "../types.js";

const STATION_STATE: StationState = {
  slot: 1,
  archetype: "kepler_yard",
  owner_pubkey: "PK",
  owner_label: "Test Yard",
  hull: 100,
  hull_max: 100,
  credits: 1_000,
  inventory: [],
  prices: [],
  docked_pilots: [],
  available_upgrades: [],
};

function makeStationService(): SignalStationService {
  return new SignalStationService(undefined, {
    apiUrl: "https://signal.test",
    token: "T",
    fetch: vi.fn() as typeof fetch,
    subscribe: false,
  });
}

function makeRuntime(
  station: SignalStationService | null,
  config?: unknown,
): IAgentRuntime {
  const runtime: Partial<IAgentRuntime> = {
    getSetting: vi.fn((key: string) =>
      key === "SIGNAL_AUTOPILOT_CONFIG" && config !== undefined
        ? JSON.stringify(config)
        : null,
    ),
    getService: <T extends Service>() => station as T | null,
  };
  return runtime as IAgentRuntime;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AutopilotService", () => {
  it("uses the framework lifecycle and releases subscriptions and timers", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const station = makeStationService();
    const unsubscribe = vi.fn();
    vi.spyOn(station, "onEvent").mockReturnValue(unsubscribe);
    vi.spyOn(station, "getStation").mockResolvedValue(STATION_STATE);

    const service = await AutopilotService.start(makeRuntime(station));

    expect(service.engage()).toContain("Autopilot engaged");
    expect(service.isEnabled()).toBe(true);
    expect(station.onEvent).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);

    await service.stop();

    expect(service.isEnabled()).toBe(false);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("refuses to engage when the station service is unavailable", async () => {
    const service = await AutopilotService.start(makeRuntime(null));

    expect(service.engage()).toContain("station service not available");
    expect(service.isEnabled()).toBe(false);
    await service.stop();
  });

  it("accepts valid config values and ignores values outside their domains", async () => {
    const service = await AutopilotService.start(
      makeRuntime(null, {
        priceIntervalMs: -1,
        inventoryLowThreshold: 5,
        inventoryHighThreshold: Number.POSITIVE_INFINITY,
        hullRepairThreshold: 2,
        greetOnDock: false,
        respondToRadio: "no",
        personality: "gruff",
      }),
    );

    expect(service.getConfig()).toEqual({
      priceIntervalMs: 60_000,
      inventoryLowThreshold: 5,
      inventoryHighThreshold: 200,
      hullRepairThreshold: 0.5,
      greetOnDock: false,
      respondToRadio: true,
      personality: "gruff",
    });
  });

  it("falls back to defaults when config JSON is malformed", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const runtime = makeRuntime(null);
    vi.mocked(runtime.getSetting).mockReturnValue("{");

    const service = await AutopilotService.start(runtime);

    expect(service.getConfig().priceIntervalMs).toBe(60_000);
    expect(warning).toHaveBeenCalledWith(
      "[autopilot] failed to parse SIGNAL_AUTOPILOT_CONFIG, using defaults",
    );
  });
});
