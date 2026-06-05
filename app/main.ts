// app/main.ts
import { startBuilder } from '../src/render/builder-view';
import type { Build } from '../src/index';

startBuilder({
  onFight: (build: Build) => {
    console.log('TODO SP3: fight with build', build);
  },
});
