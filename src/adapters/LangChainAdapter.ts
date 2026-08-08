import { AgentomyConfig } from '../client';
import { BaseAdapter, GovernedAgent } from './base';

/** Framework agent interface -- consumer provides the real type */
export interface LangChainAgentLike {
  name?: string;
  role?: string;
  run?: (input: unknown) => Promise<unknown>;
  invoke?: (input: unknown) => Promise<unknown>;
  execute?: (input: unknown) => Promise<unknown>;
}

/**
 * LangChainAdapter -- wraps LangChain agents with Agentomy governance.
 * Does not import the LangChain framework. The consumer provides their agent.
 */
export class LangChainAdapter extends BaseAdapter {
  constructor(config?: AgentomyConfig) {
    super(config || {}, 'langchain_agent');
  }

  wrap(agent: LangChainAgentLike): GovernedAgent {
    const agentName = agent.name || agent.role || 'langchain_agent';
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
