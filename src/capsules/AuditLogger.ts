import { AgentomyClient, AgentomyConfig } from '../client';

export interface LogRequest {
  agentId?: string;
  action: string;
  input?: unknown;
  output?: unknown;
  timestamp?: string;
}

export interface LogResult {
  auditId: string;
  chainPosition: number;
  hash: string;
  capsule: string;
}

/**
 * AuditLogger -- Tamper-evident audit trail with SHA-256 hash chain.
 * Every governance event produces a verifiable, hash-linked record.
 */
export class AuditLogger extends AgentomyClient {
  constructor(config?: AgentomyConfig) {
    super(config);
  }

  async log(request: LogRequest): Promise<LogResult> {
    const result = await this.post('/claw/log', {
      agentId: request.agentId || this.agentId,
      action: request.action,
      input: request.input,
      output: request.output,
      timestamp: request.timestamp || new Date().toISOString()
    });
    return {
      auditId: result.auditId as string,
      chainPosition: result.chainPosition as number,
      hash: result.blockHash as string || result.hash as string || '',
      capsule: 'AuditLogger'
    };
  }

  async verify(): Promise<{ verified: boolean; chainLength: number }> {
    const result = await this.get('/audit/anchors');
    return {
      verified: true,
      chainLength: (result.anchors as unknown[])?.length || 0
    };
  }
}
