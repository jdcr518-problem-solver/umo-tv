import type { MatchmakingState } from '@shared/types.js';

export type StateChangeObserver = (newState: MatchmakingState, previousState: MatchmakingState) => void;

export class MatchmakingStateMachine {
  private currentState: MatchmakingState = 'IDLE';
  private observers: Set<StateChangeObserver> = new Set();
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  getState(): MatchmakingState {
    return this.currentState;
  }

  subscribe(observer: StateChangeObserver): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  transitionTo(nextState: MatchmakingState, timeoutMs?: number, onTimeoutState?: MatchmakingState): void {
    if (this.currentState === nextState) return;

    this.clearTimeout();

    const prevState = this.currentState;
    this.currentState = nextState;

    this.observers.forEach((obs) => obs(nextState, prevState));

    if (timeoutMs && onTimeoutState) {
      this.timeoutId = setTimeout(() => {
        console.warn(`[MatchmakingStateMachine] Timeout reached for state ${nextState}, moving to ${onTimeoutState}`);
        this.transitionTo(onTimeoutState);
      }, timeoutMs);
    }
  }

  clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  reset(): void {
    this.clearTimeout();
    this.transitionTo('IDLE');
  }
}

export const matchmakingMachine = new MatchmakingStateMachine();
