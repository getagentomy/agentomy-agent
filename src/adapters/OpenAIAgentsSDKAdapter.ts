import { AgentomyConfig } from '../client';
import { BaseAdapter, GovernedAgent } from './base';

/** Framework agent interface -- consumer provides the real type */
export interface OpenAIAgentLike {
  name?: string;
  run?: (input: unknown) => Promise<unknown>;
  invoke?: (input: unknown) => Promise<unknown>;
  execute?: (input: unknown) => Promise<unknown>;
}

/**
 * OpenAIAgentsSDKAdapter -- wraps OpenAI Agents SDK agents with Agentomy governance.
 * Does not import the OpenAI Agents SDK. The consumer provides their agent.
 */
export class OpenAIAgentsSDKAdapter extends BaseAdapter {
  constructor(config?: AgentomyConfig) {
    super(config || {}, 'openai_agents_sdk_agent');
  }

  wrap(agent: OpenAIAgentLike): GovernedAgent {
    const agentName = agent.name || 'openai_agents_sdk_agent';
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
