import { AgentomyConfig } from '../client';
import { BaseAdapter, GovernedAgent } from './base';

/** Framework agent interface -- consumer provides the real type */
export interface AgnoAgentLike {
  name?: string;
  run?: (input: unknown) => Promise<unknown>;
  invoke?: (input: unknown) => Promise<unknown>;
  execute?: (input: unknown) => Promise<unknown>;
}

/**
 * AgnoAdapter -- wraps Agno agents with Agentomy governance.
 * Does not import the Agno framework. The consumer provides their agent.
 */
export class AgnoAdapter extends BaseAdapter {
  constructor(config?: AgentomyConfig) {
    super(config || {}, 'agno_agent');
  }

  wrap(agent: AgnoAgentLike): GovernedAgent {
    const agentName = agent.name || 'agno_agent';
    this.agentName = agentName;

    return {
      run: async (input: unknown) => {
        return this.govern('agent_execute', async () => {
          const fn = agent.run || agent.invoke || agent.execute;
          if (!fn) { throw new Error('Agent has no run/invoke/execute method'); }
          return fn.call(agent, input);
        });
      },
      halt: async (reason?: string) => {
        return this.haltAgent(reason || 'operator_command');
      }
    };
  }
}
