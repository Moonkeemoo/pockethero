// app/main.ts — screen manager. Owns the SaveState; coordinates builder ↔ fight.
import { startBuilder } from '../src/render/builder-view';
import { startGauntlet } from '../src/render/gauntlet-fight';
import * as meta from '../src/game/meta';
import type { RewardEvent } from '../src/game/meta';
import type { Build } from '../src/index';

let stop: (() => void) | null = null;
let state = meta.load();

function showBuilder(events?: RewardEvent[]): void {
  stop?.(); stop = null;
  stop = startBuilder({ state, onFight: (b: Build) => onFight(b), rewardEvents: events });
}

function onFight(build: Build): void {
  state.heroBuild = build;
  meta.save(state);
  showFight(build);
}

function showFight(build: Build): void {
  stop?.(); stop = null;
  stop = startGauntlet({
    heroBuild: build,
    onExit: (r: { won: boolean; stagesCleared: number }) => {
      const { events } = meta.addFightReward(state, r);
      meta.save(state);
      showBuilder(events);
    },
  });
}

showBuilder();
