// app/main.ts — lobby ↔ battle screen manager.
// Boot → Lobby. «В БІЙ» launches the roguelite run; the run returns to the lobby on exit.
import { startLobby } from '../src/render/lobby-view';
import { startCampaignBattle } from '../src/render/gauntlet-fight';
import * as meta from '../src/game/meta';
import type { RewardEvent } from '../src/game/meta';

const state = meta.load();
let stop: (() => void) | null = null;

function showLobby(events?: RewardEvent[], lastOutcome?: 'levelCleared' | 'defeated'): void {
  stop?.(); stop = startLobby({ state, rewardEvents: events, lastOutcome, onBattle: () => showBattle() });
}

function showBattle(): void {
  stop?.(); stop = startCampaignBattle({
    state,
    onExit: (result) => { meta.save(state); showLobby(result.rewards, result.outcome); },
  });
}

showLobby();
