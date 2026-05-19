// src/orchestration/state-machine.ts
export enum SessionState {
  INIT = 'INIT',
  BASE_IR_READY = 'BASE_IR_READY',
  PERSONALITY_DONE = 'PERSONALITY_DONE',
  ROUTING = 'ROUTING',
  EVENT_ANALYSIS = 'EVENT_ANALYSIS',
  INTERACTION_ANALYSIS = 'INTERACTION_ANALYSIS',
}

interface TransitionRule {
  from: SessionState;
  to: SessionState;
  condition?: (context: any) => boolean;
}

const defaultTransitions: TransitionRule[] = [
  { from: SessionState.INIT, to: SessionState.BASE_IR_READY, condition: (ctx) => !!ctx.chartData },
  { from: SessionState.BASE_IR_READY, to: SessionState.PERSONALITY_DONE, condition: () => true },
  { from: SessionState.PERSONALITY_DONE, to: SessionState.ROUTING, condition: (ctx) => !!ctx.userIntent && ctx.userIntent !== '互动关系' },
  { from: SessionState.PERSONALITY_DONE, to: SessionState.INTERACTION_ANALYSIS, condition: (ctx) => ctx.userIntent === '互动关系' },
  { from: SessionState.ROUTING, to: SessionState.EVENT_ANALYSIS, condition: (ctx) => ctx.routingComplete === true },
  { from: SessionState.EVENT_ANALYSIS, to: SessionState.ROUTING, condition: (ctx) => ctx.switchMatter === true },
  { from: SessionState.EVENT_ANALYSIS, to: SessionState.INTERACTION_ANALYSIS, condition: (ctx) => ctx.needInteraction === true },
  { from: SessionState.INTERACTION_ANALYSIS, to: SessionState.PERSONALITY_DONE, condition: () => true },
];

export class StateMachine {
  private currentState: SessionState;

  constructor(initialState: SessionState) {
    this.currentState = initialState;
  }

  getState(): SessionState {
    return this.currentState;
  }

  setState(newState: SessionState) {
    this.currentState = newState;
  }

  advance(context: any): boolean {
    const rule = defaultTransitions.find(
      t => t.from === this.currentState && (!t.condition || t.condition(context))
    );
    if (rule) {
      this.currentState = rule.to;
      return true;
    }
    return false;
  }

  canTransition(target: SessionState, context: any): boolean {
    return defaultTransitions.some(
      t => t.from === this.currentState && t.to === target && (!t.condition || t.condition(context))
    );
  }
}