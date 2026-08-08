import { AgentomyClient, AgentomyConfig } from '../client';

export interface EthicsCheckRequest {
  agentId?: string;
  action: string;
  payload?: unknown;
  metadata?: Record<string, unknown>;
}

export interface EthicsCheckResult {
  permitted: boolean;
  stages: unknown[];
  latencyMs: number;
  capsule: string;
}

/**
 * EthicsConstraint -- Ethics enforcement at the governance layer.
 * Evaluates agent actions against defined ethical boundaries
 * through the governance pipeline.
 */
export class EthicsConstraint extends AgentomyClient {
  constructor(config?: AgentomyConfig) {
    super(config);
  }

  async evaluate(request: EthicsCheckRequest): Promise<EthicsCheckResult> {
    const result = await this.post('/pipeline/execute', {
      agentId: request.agentId || this.agentId,
      action: `ethics:${request.action}`,
      payload: request.payload,
      metadata: { ...request.metadata, evaluationType: 'ethics' }
    });
    return {
      permitted: !(result.blocked as boolean),
      stages: result.stages as unknown[] || [],
      latencyMs: result.latencyMs as number,
      capsule: 'EthicsConstraint'
    };
  }
}
