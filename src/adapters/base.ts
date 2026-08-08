/**
 * Base adapter pattern for framework integration.
 * Each adapter wraps a framework agent with governance:
 * - PermissionRouter check before execution
 * - AuditLogger logging on every action
 * - HaltProtocol available for emergency stop
 *
 * Adapters do NOT add framework dependencies.
 * The consumer imports their own framework.
 * Agentomy-agent stays lightweight and framework-agnostic.
 *
 * Canonical vocabulary (audit RC#8 P04-F07, F09, F10):
 * - HALT_REASON: canonical halt-reason strings; adapters SHOULD use these instead of ad-hoc literals
 * - ACTION_NAME: canonical govern() action-name strings; cross-adapter pattern matching depends on stability
 * - wrapHalt(): cooperative-shutdown helper; tries wrapped.halt() first, then platform halt
 */

import { AgentomyConfig } from '../client';
import { PermissionRouter } from '../capsules/PermissionRouter';
import { AuditLogger } from '../capsules/AuditLogger';
import { HaltProtocol } from '../capsules/HaltProtocol';

/**
 * Canonical halt-reason taxonomy. Adapters set their domain-default + accept caller-supplied overrides.
 * Audit RC#8 P04-F07: pre-existing adapters used ad-hoc strings (fleet_safety_halt / clinical_safety_halt /
 * ics_safety_halt / cloud_safety_halt / operator_command) -- no shared enum prevented cross-adapter policy
 * matching ("block all clinical halts during maintenance window"). These canonical strings preserve the
 * pre-existing literal values for backwards compatibility while making the taxonomy explicit.
 */
export const HALT_REASON = {
  OPERATOR_COMMAND: 'operator_command',
  FLEET_SAFETY: 'fleet_safety_halt',
  CLINICAL_SAFETY: 'clinical_safety_halt',
  ICS_SAFETY: 'ics_safety_halt',
  CLOUD_SAFETY: 'cloud_safety_halt',
} as const;
export type HaltReason = typeof HALT_REASON[keyof typeof HALT_REASON];

/**
 * Canonical govern() action-name taxonomy. Adapters MAY append a colon-suffix specifier
 * (e.g. ACTION_NAME.CLOUD_ACTION + ':delete_instance'). PermissionRouter pattern matching
 * across adapters depends on prefix stability.
 * Audit RC#8 P04-F10: action-name vocabulary drift between adapters meant cross-cutting policies
 * (e.g. "block all halts during maintenance") could not be written with a single pattern.
 */
export const ACTION_NAME = {
  AGENT_EXECUTE: 'agent_execute',
  CLOUD_ACTION: 'cloud_action',
  ICS_ACTUATION: 'ics_actuation',
  CLINICAL_DECISION: 'clinical_decision',
  AUTONOMOUS_OPERATION: 'autonomous_operation',
  RPA_EXECUTE: 'execute',
  /**
   * A tool the model asked to run, decided on before the caller executes it. Distinct
   * from AGENT_EXECUTE because "may talk to the model" and "may run this tool" are
   * different authorizations -- see AnthropicSDKAdapter.
   */
  TOOL_CALL: 'tool_call',
  /**
   * A corpus read, decided on separately from the synthesis that follows it. Distinct
   * from AGENT_EXECUTE because which corpus an agent may read is a policy question
   * independent of whether it may reach a model -- see LlamaIndexAdapter.
   */
  RETRIEVAL_QUERY: 'query',
} as const;
export type ActionName = typeof ACTION_NAME[keyof typeof ACTION_NAME];

export interface GovernedAgent {
  run: (input: unknown) => Promise<unknown>;
  halt: (reason?: string) => Promise<{ halted: boolean; proof: string }>;
}

/**
 * Minimal shape an adapter's wrapped object MAY implement to support cooperative shutdown.
 * Vertical adapters (RPA / AV-fleet / IIoT / Cloud / Medical) often have a domain-native halt
 * method that should run BEFORE the platform halt (so the wrapped device / process / job
 * can clean up). wrapHalt() in BaseAdapter calls wrapped.halt() first, then this.haltAgent().
 */
export interface HaltableWrapped {
  halt?: (reason: string) => Promise<void> | void;
}

export class BaseAdapter {
  protected router: PermissionRouter;
  protected logger: AuditLogger;
  protected halt: HaltProtocol;
  protected agentName: string;

  constructor(config: AgentomyConfig, agentName: string) {
    this.router = new PermissionRouter(config);
    this.logger = new AuditLogger(config);
    this.halt = new HaltProtocol(config);
    this.agentName = agentName;
  }

  protected async govern(action: string, executeFn: () => Promise<unknown>): Promise<unknown> {
    // Check halt state FIRST -- halted agents cannot execute any action
    const haltStatus = await this.halt.status();
    if (haltStatus.halted) {
      await this.logger.log({ action: 'execution_blocked_halt', input: { agent: this.agentName, reason: 'Agent is halted' } });
      throw new Error(`Agent is halted. Reason: ${haltStatus.reason || 'operator command'}. Resume required before execution.`);
    }

    const permitted = await this.router.check({
      action,
      metadata: { agent: this.agentName, adapter: this.constructor.name }
    });

    if (!permitted.authorized) {
      await this.logger.log({ action: 'execution_blocked', input: { agent: this.agentName, reason: permitted.reason } });
      throw new Error(`Agent execution blocked by PermissionRouter: ${permitted.reason || 'not authorized'}`);
    }

    await this.logger.log({ action: 'execution_started', input: { agent: this.agentName } });
    const result = await executeFn();
    await this.logger.log({ action: 'execution_completed', input: { agent: this.agentName }, output: { success: true } });
    return result;
  }

  async haltAgent(reason: string = HALT_REASON.OPERATOR_COMMAND): Promise<{ halted: boolean; proof: string }> {
    return this.halt.execute({ reason, operatorId: 'adapter-sdk' });
  }

  /**
   * Cooperative-halt helper. Closes audit RC#8 P04-F09: framework adapters do not call wrapped
   * object's own halt; vertical adapters do (inconsistently). With wrapHalt(), every adapter
   * can opt into the cooperative pattern uniformly.
   *
   * Behavior:
   *   1. If `wrapped.halt` exists, call it with the reason (best-effort; failure does NOT block platform halt)
   *   2. Always call this.haltAgent() to record the platform halt + obtain proof
   *
   * Adapters whose framework lacks a halt primitive can ignore this helper + call haltAgent directly.
   */
  protected async wrapHalt(
    wrapped: HaltableWrapped | null | undefined,
    reason: string = HALT_REASON.OPERATOR_COMMAND,
  ): Promise<{ halted: boolean; proof: string }> {
    if (wrapped && typeof wrapped.halt === 'function') {
      try {
        await wrapped.halt(reason);
      } catch {
        // wrapped halt failed; still proceed to platform halt for proof + audit
      }
    }
    return this.haltAgent(reason);
  }
}
