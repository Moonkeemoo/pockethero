// app/main.ts — lobby-centric screen manager.
// Boot → Lobby. Lobby routes to battle / builder / chest. All share one persisted SaveState.
import { startLobby } from '../src/render/lobby-view';
import { startBuilder } from '../src/render/builder-view';
import { startCampaignBattle } from '../src/render/gauntlet-fight';
import * as meta from '../src/game/meta';
import type { Build } from '../src/index';
import type { RewardEvent } from '../src/game/meta';

const state = meta.load();
let stop: (() => void) | null = null;

function showLobby(events?: RewardEvent[], lastOutcome?: 'levelCleared' | 'defeated'): void {
  stop?.(); stop = startLobby({
    state,
    rewardEvents: events,
    lastOutcome,
    onBattle:  () => showBattle(),
    onBuilder: () => showBuilder(),
    // Opens a chest and returns the granted cube. The lobby plays the
    // rattle→burst→reveal choreography and calls this at the burst moment, so
    // we do NOT re-mount here — the lobby stays up and reflects the new state.
    onChest:   () => {
      const r = meta.openChest(state);
      meta.save(state);
      return { ok: r.ok, cube: r.cubes[0] };
    },
  });
}

function showBuilder(): void {
  stop?.(); stop = startBuilder({
    state,
    onFight: (b: Build) => {
      state.heroBuild = b;
      meta.save(state);
      showLobby();
    },
  });
}

function showBattle(): void {
  stop?.(); stop = startCampaignBattle({
    state,
    onExit: (result) => {
      meta.save(state);
      showLobby(result.rewards, result.outcome);
    },
  });
}

showLobby();
