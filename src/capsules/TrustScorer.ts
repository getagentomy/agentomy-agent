import { AgentomyClient, AgentomyConfig } from '../client';

export interface TrustScore {
  agentId: string;
  score: number;
  alerts: unknown[];
  baseline: unknown;
  capsule: string;
}

/**
 * TrustScorer -- Behavioral trust assessment.
 * Scores agent behavior against established baselines
 * and flags anomalies for governance review.
 */
export class TrustScorer extends AgentomyClient {
  constructor(config?: AgentomyConfig) {
    super(config);
  }

  async score(agentId?: string): Promise<TrustScore> {
    const id = agentId || this.agentId;
    const result = await this.get(`/monitor/agent/${id}`);
    return {
      agentId: id,
      score: result.trustScore as number || result.score as number || 0,
      alerts: result.alerts as unknown[] || [],
      baseline: result.baseline || null,
      capsule: 'TrustScorer'
    };
  }
}
