import { AgentomyClient, AgentomyConfig } from '../client';

export interface TopologyResult {
  agents: unknown[];
  relationships: unknown[];
  capsule: string;
}

/**
 * TeamCoordinator -- Multi-agent orchestration governance.
 * Tracks parent-child agent relationships and governance coverage
 * across the agent session graph.
 */
export class TeamCoordinator extends AgentomyClient {
  constructor(config?: AgentomyConfig) {
    super(config);
  }

  async topology(): Promise<TopologyResult> {
    const result = await this.get('/agent/topology');
    return {
      agents: result.agents as unknown[] || [],
      relationships: result.relationships as unknown[] || [],
      capsule: 'TeamCoordinator'
    };
  }

  async agentHistory(agentId: string): Promise<{ events: unknown[] }> {
    const result = await this.get(`/cc/agents/${agentId}/history`);
    return { events: result.events as unknown[] || [] };
  }
}
