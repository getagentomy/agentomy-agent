import { AgentomyConfig } from '../client';
import { BaseAdapter, GovernedAgent } from './base';

/** Framework agent interface -- consumer provides the real type */
export interface HaystackAgentLike {
  name?: string;
  role?: string;
  run?: (input: unknown) => Promise<unknown>;
  invoke?: (input: unknown) => Promise<unknown>;
  execute?: (input: unknown) => Promise<unknown>;
}

/**
 * HaystackAdapter -- wraps Haystack agents with Agentomy governance.
 * Does not import the Haystack framework. The consumer provides their agent.
 */
export class HaystackAdapter extends BaseAdapter {
  constructor(config?: AgentomyConfig) {
    super(config || {}, 'haystack_agent');
  }

  wrap(agent: HaystackAgentLike): GovernedAgent {
    const agentName = agent.name || agent.role || 'haystack_agent';
    this.agentName = agentName;

    return {
      run: async (input: unknown) => {
        return this.govern('agent_execute', async () => {
          const fn = agent.run || agent.invoke || agent.execute;
          if (!fn) {throw new Error('Agent has no run/invoke/execute method');}
          return fn.call(agent, input);
        });
      },
      halt: async (reason?: string) => {
        return this.haltAgent(reason || 'operator_command');
      }
    };
  }
}
