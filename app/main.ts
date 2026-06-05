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
    onChest:   () => {
      const r = meta.openChest(state);
      meta.save(state);
      if (r.ok) {
        showLobby(r.events);
      } else {
        showLobby([{ kind: 'info', text: 'Недостатньо монет' }]);
      }
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
