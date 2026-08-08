import { AgentomyConfig } from '../client';
import { BaseAdapter, GovernedAgent } from './base';

/** RPA bot interface -- consumer provides the real type */
export interface RPABotLike {
  name?: string;
  platform?: string;
  execute?: (process: string, params?: unknown) => Promise<unknown>;
  run?: (process: string, params?: unknown) => Promise<unknown>;
  stop?: (reason?: string) => Promise<void>;
  status?: () => Promise<{ running: boolean; process?: string }>;
}

/**
 * RPAAdapter -- wraps RPA bots with Agentomy governance.
 * Does not import any RPA framework. The consumer provides their bot.
 * Supports gate mode (pre-execution authorization) and observer mode (post-execution logging).
 */
export class RPAAdapter extends BaseAdapter {
  private platform: string;

  constructor(config?: AgentomyConfig, platform = 'custom') {
    super(config || {}, `rpa_${platform}_bot`);
    this.platform = platform;
  }

  wrap(bot: RPABotLike): GovernedAgent {
    const botName = bot.name || `rpa_${this.platform}_bot`;
    this.agentName = botName;

    return {
      run: async (input: unknown) => {
        const processInput = input as { process: string; params?: unknown; targetSystem?: string };
        const scope = processInput.targetSystem
          ? `process:${processInput.process}|system:${processInput.targetSystem}`
          : `process:${processInput.process}`;

        return this.govern(`execute:${scope}`, async () => {
          const fn = bot.execute || bot.run;
          if (!fn) {throw new Error('Bot has no execute/run method');}
          return fn.call(bot, processInput.process, processInput.params);
        });
      },
      halt: async (reason?: string) => {
        if (bot.stop) {
          await bot.stop(reason);
        }
        return this.haltAgent(reason || 'operator_command');
      }
    };
  }
}
