import { AgentomyClient, AgentomyConfig } from '../client';

export interface DeployRequest {
  agentId?: string;
  persona: string;
  container?: string;
  config?: Record<string, unknown>;
}

export interface DeployResult {
  id: string;
  persona: string;
  status: string;
  capsule: string;
}

/**
 * AgentSandbox -- Containment and isolation for agent execution.
 * Deploys agents within governed sandbox boundaries.
 */
export class AgentSandbox extends AgentomyClient {
  constructor(config?: AgentomyConfig) {
    super(config);
  }

  async deploy(request: DeployRequest): Promise<DeployResult> {
    const result = await this.post('/agents/deploy', {
      persona: request.persona,
      container: request.container,
      config: request.config
    }) as Record<string, unknown>;
    const agent = result.agent as Record<string, unknown>;
    return {
      id: agent.id as string,
      persona: agent.persona as string,
      status: agent.status as string,
      capsule: 'AgentSandbox'
    };
  }

  async status(agentId: string): Promise<Record<string, unknown>> {
    return this.get(`/agents/${agentId}/status`);
  }
}
