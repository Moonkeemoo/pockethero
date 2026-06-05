// app/main.ts
import { startBuilder } from '../src/render/builder-view';
import { startGauntlet } from '../src/render/gauntlet-fight';
import type { Build } from '../src/index';

let stop: (() => void) | null = null;

function showBuilder(): void {
  stop?.(); stop = null;
  stop = startBuilder({ onFight: (build: Build) => showFight(build) });
}

function showFight(build: Build): void {
  stop?.(); stop = null;
  stop = startGauntlet({ heroBuild: build, onExit: () => showBuilder() });
}

showBuilder();
