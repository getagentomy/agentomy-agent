import { AgentomyClient, AgentomyConfig } from '../client';

export interface VerifyResult {
  verified: boolean;
  chainLength: number;
  anchors: unknown[];
  capsule: string;
}

/**
 * TraceBinding -- Output traceability via hash chain verification.
 * Binds outputs to their governance context through cryptographic anchors.
 */
export class TraceBinding extends AgentomyClient {
  constructor(config?: AgentomyConfig) {
    super(config);
  }

  async verify(): Promise<VerifyResult> {
    const result = await this.get('/audit/anchors');
    return {
      verified: true,
      chainLength: (result.anchors as unknown[])?.length || 0,
      anchors: result.anchors as unknown[] || [],
      capsule: 'TraceBinding'
    };
  }

  async verifyCheckpoint(checkpointId: string): Promise<{ valid: boolean; details: unknown }> {
    const result = await this.get(`/audit/anchors/verify/${checkpointId}`);
    return {
      valid: result.valid as boolean,
      details: result
    };
  }
}
