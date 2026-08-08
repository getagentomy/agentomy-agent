import { AgentomyClient, AgentomyConfig } from '../client';

export interface GovernanceSummary {
  agents: number;
  policies: number;
  compliance: unknown;
  status: string;
  capsule: string;
}

/**
 * DeploymentManifest -- Governance transparency at deployment.
 * Captures and reports the governance configuration, capsule state,
 * and policy status active at the time of deployment.
 */
export class DeploymentManifest extends AgentomyClient {
  constructor(config?: AgentomyConfig) {
    super(config);
  }

  async snapshot(): Promise<GovernanceSummary> {
    const result = await this.get('/governance/summary');
    return {
      agents: result.totalAgents as number || 0,
      policies: result.totalPolicies as number || 0,
      compliance: result.compliance || result.frameworks || {},
      status: result.status as string || 'active',
      capsule: 'DeploymentManifest'
    };
  }

  async health(): Promise<{ healthy: boolean; services: unknown }> {
    const result = await this.get('/health');
    return {
      healthy: result.status === 'ok' || result.status === 'healthy',
      services: result
    };
  }
}
