import { AgentomyConfig } from '../client';
import { BaseAdapter, GovernedAgent } from './base';

/** Framework agent interface -- consumer provides the real type */
export interface OpenClawAgentLike {
  name?: string;
  run?: (input: unknown) => Promise<unknown>;
  invoke?: (input: unknown) => Promise<unknown>;
  execute?: (input: unknown) => Promise<unknown>;
}

/**
 * OpenClawAdapter -- wraps OpenClaw agents with Agentomy governance.
 * Does not import the OpenClaw framework. The consumer provides their agent.
 */
export class OpenClawAdapter extends BaseAdapter {
  constructor(config?: AgentomyConfig) {
    super(config || {}, 'openclaw_agent');
  }

  wrap(agent: OpenClawAgentLike): GovernedAgent {
    const agentName = agent.name || 'openclaw_agent';
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
