export type CombatEvent =
  | { type: 'move-start'; actor: string; move: string; t: number }
  | { type: 'hit'; source: string; target: string; amount: number; crit: boolean; school?: string; t: number }
  | { type: 'block'; target: string; t: number }
  | { type: 'dodge'; target: string; t: number }
  | { type: 'status-applied'; target: string; status: string; t: number }
  | { type: 'status-tick'; target: string; status: string; amount: number; t: number }
  | { type: 'heal'; target: string; amount: number; t: number }
  | { type: 'ko'; target: string; t: number };

export interface EventBus {
  emit(e: CombatEvent): void;
  /** returns buffered events and clears the buffer */
  drain(): CombatEvent[];
}

export function makeBus(): EventBus {
  let buf: CombatEvent[] = [];
  return {
    emit: (e) => { buf.push(e); },
    drain: () => { const out = buf; buf = []; return out; },
  };
}
