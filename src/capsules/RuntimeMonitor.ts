import { AgentomyClient, AgentomyConfig } from '../client';

export interface MonitorStatus {
  active: boolean;
  agents: unknown[];
  anomalies: unknown[];
  capsule: string;
}

/**
 * RuntimeMonitor -- Real-time observability for governed agents.
 * Monitors behavioral patterns, resource usage, and governance
 * compliance during active sessions.
 */
export class RuntimeMonitor extends AgentomyClient {
  constructor(config?: AgentomyConfig) {
    super(config);
  }

  async status(): Promise<MonitorStatus> {
    const result = await this.get('/monitor/status');
    return {
      active: result.active as boolean || true,
      agents: result.agents as unknown[] || [],
      anomalies: result.anomalies as unknown[] || [],
      capsule: 'RuntimeMonitor'
    };
  }

  async anomalies(): Promise<{ anomalies: unknown[] }> {
    const result = await this.get('/anomaly/status');
    return { anomalies: result.anomalies as unknown[] || [] };
  }
}
