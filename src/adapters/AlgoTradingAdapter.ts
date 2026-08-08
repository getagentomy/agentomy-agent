import { AgentomyConfig } from '../client';
import { BaseAdapter, GovernedAgent, HaltableWrapped, HALT_REASON } from './base';

/**
 * AlgoTradingAdapter -- wraps an algorithmic trading agent with Agentomy governance.
 *
 * Rewrite (audit RC#7, 2026-06-21): converted from factory function to class extending
 * BaseAdapter. The prior factory exported (createAlgoTradingAdapter) is preserved as a
 * thin wrapper for backwards compatibility so existing consumers do not break, but new
 * consumers SHOULD use the class form for parity with the other 21 adapters.
 *
 * Closes:
 * - P04-001 (does not implement GovernedAgent contract) -- wrap() now returns {run, halt}
 * - P04-002 (missing halt method) -- inherited from BaseAdapter via wrapHalt()
 * - P04-003 (missing run method) -- govern() wraps the trading agent's order-execute path
 * - P04-004 (exported as factory while 21 peers are classes) -- now a class
 *
 * Algo-trading-specific methods (beforeOrder, afterOrder, onCircuitBreak) remain available
 * for the pre-trade / post-trade / circuit-break lifecycle hooks specific to trading agents.
 * They are now methods on the class rather than free functions on the returned object.
 *
 * Does not import any trading-framework dependency. The consumer provides their own
 * trading agent interface (AlgoTradingAgentLike).
 */

export type StrategyProfile = 'market_maker' | 'directional' | 'arbitrage' | 'hedging' | 'custom';
export type TradingProtocol = 'fix' | 'rest_oms' | 'websocket' | 'custom';

export interface AlgoTradingAdapterConfig extends AgentomyConfig {
  agentId?: string;
  strategyProfile?: StrategyProfile;
  protocol?: TradingProtocol;
}

export interface TradeGovernanceResult {
  authorized: boolean;
  reason?: string;
  /**
   * The governance checks that ACTUALLY ran for this decision, as reported by the
   * platform. Never a fixed list: an empty array means nothing was evaluated, and
   * that is a truthful answer. Callers may surface this to an auditor, so a name
   * appearing here is a claim we have to be able to stand behind.
   */
  checksPerformed: string[];
}

/**
 * Extract the checks the platform reports having performed. The platform is the
 * only authority on this -- the adapter cannot know what ran downstream, so it
 * reports nothing rather than guessing. `tier_authorization` is asserted only
 * when the platform returned an actual authorization decision, which is the one
 * check the current authorize path genuinely performs for every action.
 */
function checksFrom(result: unknown): string[] {
  const r = result as { checksPerformed?: unknown; authorized?: unknown } | null;
  if (r && Array.isArray(r.checksPerformed)) {
    return r.checksPerformed.filter((c): c is string => typeof c === "string");
  }
  return r && typeof r.authorized === "boolean" ? ["tier_authorization"] : [];
}

/** Trading agent interface -- consumer provides the real type */
export interface AlgoTradingAgentLike extends HaltableWrapped {
  name?: string;
  executeOrder?: (instrument: string, direction: string, quantity: number, price?: number) => Promise<unknown>;
  cancelOrder?: (orderId: string) => Promise<unknown>;
  halt?: (reason?: string) => Promise<void> | void;
}

export class AlgoTradingAdapter extends BaseAdapter {
  private strategyProfile: StrategyProfile;
  private protocol: TradingProtocol;

  constructor(config: AlgoTradingAdapterConfig = {}, agentId?: string) {
    const resolvedAgentId = agentId || config.agentId || 'algo-trading-agent';
    super(config, resolvedAgentId);
    this.strategyProfile = config.strategyProfile || 'custom';
    this.protocol = config.protocol || 'custom';
  }

  wrap(agent: AlgoTradingAgentLike): GovernedAgent {
    const agentName = agent.name || `algo-trading-${this.protocol}-${this.strategyProfile}`;
    this.agentName = agentName;

    return {
      run: async (input: unknown) => {
        const orderInput = input as {
          instrument: string;
          direction: string;
          quantity: number;
          price?: number;
        };
        const scope = `instrument:${orderInput.instrument}|direction:${orderInput.direction}|qty:${orderInput.quantity}`;
        return this.govern(`agent_execute:trading:${scope}`, async () => {
          if (!agent.executeOrder) {
            throw new Error('Trading agent has no executeOrder method');
          }
          return agent.executeOrder(orderInput.instrument, orderInput.direction, orderInput.quantity, orderInput.price);
        });
      },
      halt: async (reason?: string) => this.wrapHalt(agent, reason || HALT_REASON.OPERATOR_COMMAND),
    };
  }

  /**
   * Pre-trade governance check. Returns whether the proposed order is authorized.
   * Trading-agent-specific; preserved from the original factory shape so existing
   * pre-trade hook consumers continue to work.
   */
  async beforeOrder(
    instrument: string,
    direction: string,
    quantity: number,
    price?: number,
  ): Promise<TradeGovernanceResult> {
    const scope = `instrument:${instrument}|direction:${direction}|qty:${quantity}${price !== undefined ? `|price:${price}` : ''}`;
    try {
      const permitted = await this.router.check({
        action: `agent_execute:trading:before_order:${scope}`,
        metadata: { agent: this.agentName, strategyProfile: this.strategyProfile, protocol: this.protocol },
      });
      return {
        authorized: !!permitted.authorized,
        reason: permitted.reason,
        // Report ONLY what the governance decision actually performed. This field
        // previously returned a fixed ['velocity','position','strategy',
        // 'market_access','deployment'] on every call -- including from the catch
        // below, i.e. it named five pre-trade checks as completed even when the
        // check had thrown and none had run. No velocity, position or price-bound
        // evaluation existed anywhere in the codebase. A governance product must
        // never assert its own verification; that is the defect it exists to catch.
        checksPerformed: checksFrom(permitted),
      };
    } catch (err) {
      return {
        authorized: false,
        reason: err instanceof Error ? err.message : 'pre-trade governance check failed',
        // The check threw: nothing was evaluated, so nothing is reported.
        checksPerformed: [],
      };
    }
  }

  /**
   * Post-trade audit log. Records the fill to the audit chain.
   */
  async afterOrder(
    instrument: string,
    direction: string,
    quantity: number,
    fillPrice: number,
  ): Promise<void> {
    await this.logger.log({
      action: 'agent_execute:trading:after_order',
      input: { agent: this.agentName, instrument, direction, quantity },
      output: { fillPrice },
    });
  }

  /**
   * Circuit-break halt. Records the halt event + executes platform halt with cooperative
   * shutdown of the wrapped trading agent.
   */
  async onCircuitBreak(reason: string = 'circuit_breaker'): Promise<{ halted: boolean; proof: string }> {
    await this.logger.log({
      action: 'agent_execute:trading:circuit_break',
      input: { agent: this.agentName, reason },
    });
    return this.haltAgent(reason);
  }
}

/**
 * Factory function (backwards compatibility). Returns the original lightweight shape
 * (beforeOrder / afterOrder / onCircuitBreak only). New consumers should use the class form.
 *
 * @deprecated Use `new AlgoTradingAdapter(config)` for full GovernedAgent contract via wrap()
 */
export function createAlgoTradingAdapter(config: AlgoTradingAdapterConfig) {
  const { agentId = 'algo-trading-agent', strategyProfile = 'custom', protocol = 'custom' } = config;
  const adapter = new AlgoTradingAdapter(config, agentId);

  return {
    name: `algo-trading-${protocol}`,
    agentId,
    strategyProfile,

    async beforeOrder(instrument: string, direction: string, quantity: number, price?: number): Promise<TradeGovernanceResult> {
      return adapter.beforeOrder(instrument, direction, quantity, price);
    },

    async afterOrder(instrument: string, direction: string, quantity: number, fillPrice: number): Promise<void> {
      return adapter.afterOrder(instrument, direction, quantity, fillPrice);
    },

    async onCircuitBreak(reason: string): Promise<void> {
      await adapter.onCircuitBreak(reason);
    },
  };
}
