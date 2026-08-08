import { AgentomyClient, AgentomyConfig } from '../client';

export interface HaltRequest {
  agentId?: string;
  reason: string;
  operatorId?: string;
}

export interface HaltResult {
  halted: boolean;
  timestamp: string;
  proof: string;
  scope: string;
  capsule: string;
}

export interface ResumeRequest {
  operatorId: string;
  reason?: string;
}

/**
 * HaltProtocol -- Emergency response and shutdown capability.
 * Halts agent operations with cryptographic proof of the halt event.
 */
export class HaltProtocol extends AgentomyClient {
  constructor(config?: AgentomyConfig) {
    super(config);
  }

  async execute(request: HaltRequest): Promise<HaltResult> {
    const result = await this.post('/claw/halt', {
      agentId: request.agentId,
      reason: request.reason,
      operatorId: request.operatorId || 'operator-sdk'
    });
    return {
      halted: result.halted as boolean,
      timestamp: result.timestamp as string,
      proof: result.haltReasonHash as string || result.proof as string || '',
      scope: result.scope as string || (request.agentId ? 'agent' : 'fleet'),
      capsule: 'HaltProtocol'
    };
  }

  async status(): Promise<{ halted: boolean; reason?: string }> {
    if (this.standalone) {
      return { halted: this.state.halted, reason: this.state.haltReason };
    }
    const result = await this.get('/claw/health');
    return { halted: !!(result as any).fleetHaltActive, reason: (result as any).haltReason };
  }

  async resume(request: ResumeRequest): Promise<{ resumed: boolean; timestamp: string }> {
    const result = await this.post('/claw/resume', {
      operatorId: request.operatorId,
      reason: request.reason
    });
    return {
      resumed: result.resumed as boolean,
      timestamp: result.timestamp as string
    };
  }
}
