import { AgentomyConfig } from '../client';
import { ACTION_NAME, BaseAdapter, GovernedAgent, HALT_REASON, HaltableWrapped } from './base';

/**
 * A response content block as `@anthropic-ai/sdk` returns it. Only the fields the
 * governance decision reads are named; everything else passes through untouched, so a
 * newer SDK shape does not need this file changed.
 */
export interface AnthropicContentBlockLike {
  type: string;
  /** tool_use blocks carry the id the caller echoes back on the tool_result */
  id?: string;
  /** tool_use blocks carry the tool name -- the thing a policy actually decides on */
  name?: string;
  input?: unknown;
  [key: string]: unknown;
}

/** A Messages response. `content` is the block list; `stop_reason` is 'tool_use' when tools were requested. */
export interface AnthropicMessageLike {
  id?: string;
  model?: string;
  stop_reason?: string | null;
  content?: AnthropicContentBlockLike[];
  [key: string]: unknown;
}

/** `client.messages` -- the model-invocation surface. */
export interface AnthropicMessagesLike {
  create?: (params: Record<string, unknown>) => Promise<AnthropicMessageLike>;
  stream?: (params: Record<string, unknown>) => unknown;
}

/**
 * The consumer's Anthropic client. Structural, not the real type: this package adds no
 * framework dependencies, so `new Anthropic()` satisfies it without an import here.
 */
export interface AnthropicSDKClientLike extends HaltableWrapped {
  name?: string;
  messages?: AnthropicMessagesLike;
  beta?: { messages?: AnthropicMessagesLike };
}

/**
 * GovernedAgent, plus the surfaces an SDK client actually exposes. `run` is the
 * GovernedAgent contract and is an alias for `createMessage`; the named members exist
 * because a caller wrapping an SDK client is not calling `agent.run(input)` -- it is
 * calling `client.messages.create(params)`, and the wrapper should read like it.
 */
export interface GovernedAnthropicClient extends GovernedAgent {
  createMessage: (params: Record<string, unknown>) => Promise<AnthropicMessageLike>;
  streamMessage: (params: Record<string, unknown>) => Promise<unknown>;
  governToolUse: (block: AnthropicContentBlockLike) => Promise<AnthropicContentBlockLike>;
}

/**
 * AnthropicSDKAdapter -- wraps an `@anthropic-ai/sdk` client with Agentomy governance.
 * Does not import the Anthropic SDK. The consumer provides their client.
 *
 * WHAT THIS INTERCEPTS, AND WHY IT IS NOT THE SAME SHAPE AS THE AGENT ADAPTERS
 * ---------------------------------------------------------------------------
 * The other framework adapters wrap an *agent* -- an object with a run/invoke/execute
 * method -- and one governance decision covers the whole call. An SDK client is not an
 * agent. It has two distinct surfaces that need deciding on separately:
 *
 *   1. The model call itself (`client.messages.create` / `.stream`). Governed as
 *      ACTION_NAME.AGENT_EXECUTE, BEFORE the request leaves the process: a denial or an
 *      active halt means no request is ever sent, no tokens are spent.
 *   2. Every `tool_use` block the model asks for. Governed as ACTION_NAME.TOOL_CALL, one
 *      decision per block, BEFORE the caller executes the tool. This is the surface that
 *      matters: `messages.create` returning a tool_use for `delete_bucket` is the model
 *      *requesting* an action, and the caller is about to run it. A wrapper that governed
 *      only the model call would authorize "may talk to the model" and let every tool the
 *      model asked for through ungoverned -- detection dressed as governance.
 *
 * Each tool_use is also written to the audit chain by name and id before the decision, so
 * a denied tool leaves a record of what was asked for, not just that something was denied.
 *
 * Streaming is governed pre-flight: the decision is made before the stream is opened,
 * because there is no meaningful point to stop at afterwards.
 */
export class AnthropicSDKAdapter extends BaseAdapter {
  constructor(config?: AgentomyConfig) {
    super(config || {}, 'anthropic_sdk_agent');
  }

  wrap(client: AnthropicSDKClientLike): GovernedAnthropicClient {
    const agentName = client.name || 'anthropic_sdk_agent';
    this.agentName = agentName;

    return {
      // GovernedAgent contract. `input` is the MessageCreateParams the caller would have
      // handed straight to client.messages.create.
      run: async (input: unknown) => {
        return this.createMessage(client, (input || {}) as Record<string, unknown>);
      },
      halt: async (reason?: string) => {
        return this.wrapHalt(client, reason || HALT_REASON.OPERATOR_COMMAND);
      },
      createMessage: async (params: Record<string, unknown>) => {
        return this.createMessage(client, params);
      },
      streamMessage: async (params: Record<string, unknown>) => {
        return this.streamMessage(client, params);
      },
      governToolUse: async (block: AnthropicContentBlockLike) => {
        return this.governToolUse(block);
      }
    };
  }

  /**
   * Governed `client.messages.create`. The authorization + halt-state check runs before
   * the call; the tool_use blocks in the response are then governed individually.
   */
  private async createMessage(
    client: AnthropicSDKClientLike,
    params: Record<string, unknown>
  ): Promise<AnthropicMessageLike> {
    const response = await this.govern(ACTION_NAME.AGENT_EXECUTE, async () => {
      const messages = this.resolveMessages(client);
      if (!messages.create) {
        throw new Error('Anthropic client has no messages.create method');
      }
      return messages.create.call(messages, params);
    }) as AnthropicMessageLike;

    return this.governToolRequests(response);
  }

  /**
   * Governed `client.messages.stream`. Pre-flight only -- the decision is made before the
   * stream opens. Blocks the caller streams back are governed by passing each tool_use to
   * governToolUse(), which is why that method is on the returned object.
   */
  private async streamMessage(
    client: AnthropicSDKClientLike,
    params: Record<string, unknown>
  ): Promise<unknown> {
    return this.govern(ACTION_NAME.AGENT_EXECUTE, async () => {
      const messages = this.resolveMessages(client);
      if (!messages.stream) {
        throw new Error('Anthropic client has no messages.stream method');
      }
      return messages.stream.call(messages, params);
    });
  }

  /**
   * Runs one governance decision per tool_use block in a response. Rejects the whole
   * response if any requested tool is denied -- a partially-authorized tool batch is not a
   * state the caller can act on safely.
   */
  private async governToolRequests(response: AnthropicMessageLike): Promise<AnthropicMessageLike> {
    const blocks = Array.isArray(response?.content) ? response.content : [];
    for (const block of blocks) {
      if (block && block.type === 'tool_use') {
        await this.governToolUse(block);
      }
    }
    return response;
  }

  /**
   * The decision point for a single tool the model asked to run. Records what was asked
   * for (tool name + tool_use id) in the audit chain, then routes the request through
   * govern() -- which checks halt state, consults PermissionRouter, and throws on denial.
   * Returns the block unchanged so a caller can write `execute(await governToolUse(b))`.
   */
  private async governToolUse(block: AnthropicContentBlockLike): Promise<AnthropicContentBlockLike> {
    const toolName = block?.name || 'unknown_tool';
    await this.logger.log({
      action: 'tool_use_requested',
      input: { agent: this.agentName, tool: toolName, toolUseId: block?.id }
    });
    await this.govern(ACTION_NAME.TOOL_CALL, async () => block);
    return block;
  }

  /** `client.messages`, falling back to `client.beta.messages` for beta-only surfaces. */
  private resolveMessages(client: AnthropicSDKClientLike): AnthropicMessagesLike {
    const messages = client?.messages || client?.beta?.messages;
    if (!messages) {
      throw new Error('Anthropic client exposes no messages surface');
    }
    return messages;
  }
}
