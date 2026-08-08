import { AgentomyConfig } from '../client';
import { ACTION_NAME, BaseAdapter, GovernedAgent, HALT_REASON, HaltableWrapped } from './base';

/**
 * A retrieved node as `llamaindex` returns it from a retriever. Only the fields the
 * governance decision reads are named; everything else passes through untouched.
 */
export interface LlamaIndexNodeLike {
  score?: number;
  node?: { id_?: string; metadata?: Record<string, unknown>; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * The consumer's LlamaIndex object. Structural, not the real type: this package adds no
 * framework dependencies, so a query engine, chat engine, agent, or retriever all satisfy
 * it without importing `llamaindex` here.
 */
export interface LlamaIndexEngineLike extends HaltableWrapped {
  name?: string;
  /** query engines */
  query?: (input: unknown) => Promise<unknown>;
  /** chat engines */
  chat?: (input: unknown) => Promise<unknown>;
  /** agents */
  run?: (input: unknown) => Promise<unknown>;
  call?: (input: unknown) => Promise<unknown>;
  /** retrievers, and the retriever an index/query engine hangs off */
  retrieve?: (input: unknown) => Promise<LlamaIndexNodeLike[]>;
  retriever?: { retrieve?: (input: unknown) => Promise<LlamaIndexNodeLike[]> };
}

/**
 * GovernedAgent, plus the retrieval surface. `run` is the GovernedAgent contract and
 * covers query/chat/agent calls; `retrieve` exists because retrieval is a separate
 * decision (see the class comment) and a caller that only retrieves should not have to go
 * through the synthesis path to get it governed.
 */
export interface GovernedLlamaIndexEngine extends GovernedAgent {
  retrieve: (input: unknown) => Promise<LlamaIndexNodeLike[]>;
}

/**
 * LlamaIndexAdapter -- wraps LlamaIndex query engines, chat engines, agents, and
 * retrievers with Agentomy governance. Does not import LlamaIndex. The consumer provides
 * their engine.
 *
 * WHAT THIS INTERCEPTS
 * --------------------
 * LlamaIndex is a retrieval framework, so it has two governed surfaces rather than one,
 * and collapsing them would lose the decision that matters most here:
 *
 *   1. Synthesis -- `query()` / `chat()` / `run()` / `call()`. Governed as
 *      ACTION_NAME.AGENT_EXECUTE before the call: a denial or an active halt means the
 *      engine never runs and no model call is made.
 *   2. Retrieval -- `retrieve()`, on the engine or on its `.retriever`. Governed
 *      SEPARATELY as ACTION_NAME.RETRIEVAL_QUERY. Retrieval is a data-access action: it
 *      reads a corpus, and which corpus a given agent may read is a policy question
 *      independent of whether it may talk to a model. An adapter that governed only
 *      `query()` would authorize synthesis and let raw corpus reads through ungoverned --
 *      including the retriever calls a query engine makes internally, which is why
 *      `retrieve` is exposed rather than hidden inside `run`.
 *
 * The count of nodes returned by a governed retrieval is written to the audit chain, so
 * the record shows how much was read and not merely that a read was allowed.
 */
export class LlamaIndexAdapter extends BaseAdapter {
  constructor(config?: AgentomyConfig) {
    super(config || {}, 'llamaindex_agent');
  }

  wrap(engine: LlamaIndexEngineLike): GovernedLlamaIndexEngine {
    const agentName = engine.name || 'llamaindex_agent';
    this.agentName = agentName;

    return {
      run: async (input: unknown) => {
        return this.runEngine(engine, input);
      },
      halt: async (reason?: string) => {
        return this.wrapHalt(engine, reason || HALT_REASON.OPERATOR_COMMAND);
      },
      retrieve: async (input: unknown) => {
        return this.runRetrieval(engine, input);
      }
    };
  }

  /**
   * Governed synthesis. Authorization + halt-state check run before the engine is called,
   * so a denial means the query engine / chat engine / agent never executes.
   */
  private async runEngine(engine: LlamaIndexEngineLike, input: unknown): Promise<unknown> {
    return this.govern(ACTION_NAME.AGENT_EXECUTE, async () => {
      const fn = engine.query || engine.chat || engine.run || engine.call;
      if (!fn) {
        throw new Error('LlamaIndex engine has no query/chat/run/call method');
      }
      return fn.call(engine, input);
    });
  }

  /**
   * Governed retrieval -- the corpus-read decision, distinct from the synthesis decision.
   * Resolves the retriever from the engine itself or from its `.retriever`, so a bare
   * retriever and a query engine are both governable through the same call.
   */
  private async runRetrieval(
    engine: LlamaIndexEngineLike,
    input: unknown
  ): Promise<LlamaIndexNodeLike[]> {
    const nodes = await this.govern(ACTION_NAME.RETRIEVAL_QUERY, async () => {
      const target = typeof engine.retrieve === 'function' ? engine : engine.retriever;
      const fn = target?.retrieve;
      if (!fn) {
        throw new Error('LlamaIndex engine exposes no retrieve method');
      }
      return fn.call(target, input);
    }) as LlamaIndexNodeLike[];

    const results = Array.isArray(nodes) ? nodes : [];
    await this.logger.log({
      action: 'retrieval_completed',
      input: { agent: this.agentName },
      output: { nodesRetrieved: results.length }
    });
    return results;
  }
}
