import { AgentomyClient, AgentomyConfig } from '../client';

export interface ExecuteRequest {
  agentId?: string;
  action: string;
  scope?: string;
  payload?: unknown;
  metadata?: Record<string, unknown>;
}

export interface ExecuteResult {
  result: unknown;
  latencyMs: number;
  capsule: string;
}

/**
 * ExecutionTimer -- Runtime boundary enforcement.
 * Executes governance pipeline with latency tracking and timeout enforcement.
 */
export class ExecutionTimer extends AgentomyClient {
  constructor(config?: AgentomyConfig) {
    super(config);
  }

  async execute(request: ExecuteRequest): Promise<ExecuteResult> {
    const result = await this.post('/pipeline/execute', {
      agentId: request.agentId || this.agentId,
      action: request.action,
      scope: request.scope,
      payload: request.payload,
      metadata: request.metadata
    });
    return {
      result,
      latencyMs: result.latencyMs as number,
      capsule: 'ExecutionTimer'
    };
  }
}
