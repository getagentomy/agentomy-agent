import { AgentomyClient, AgentomyConfig } from '../client';

export interface DecisionRequest {
  agentId?: string;
  action: string;
  decision: string;
  rationale?: string;
  metadata?: Record<string, unknown>;
}

export interface DecisionResult {
  auditId: string;
  chainPosition: number;
  capsule: string;
}

/**
 * DecisionLog -- Records governance decisions with full context.
 * Every decision is logged with rationale for compliance reporting.
 */
export class DecisionLog extends AgentomyClient {
  constructor(config?: AgentomyConfig) {
    super(config);
  }

  async record(request: DecisionRequest): Promise<DecisionResult> {
    const result = await this.post('/claw/log', {
      agentId: request.agentId || this.agentId,
      action: `decision:${request.action}`,
      input: { decision: request.decision, rationale: request.rationale },
      output: request.metadata
    });
    return {
      auditId: result.auditId as string,
      chainPosition: result.chainPosition as number,
      capsule: 'DecisionLog'
    };
  }
}
