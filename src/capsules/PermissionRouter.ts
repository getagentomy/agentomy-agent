import { AgentomyClient, AgentomyConfig } from '../client';

export interface AuthorizeRequest {
  agentId?: string;
  action: string;
  scope?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorizeResult {
  authorized: boolean;
  tier: string;
  reason?: string;
  auditId: string;
  capsule: string;
}

/**
 * PermissionRouter -- Access control and permission evaluation.
 * Routes requests through governance permission checks before
 * any agent action is permitted.
 */
export class PermissionRouter extends AgentomyClient {
  constructor(config?: AgentomyConfig) {
    super(config);
  }

  async check(request: AuthorizeRequest): Promise<AuthorizeResult> {
    const result = await this.post('/claw/authorize', {
      agentId: request.agentId || this.agentId,
      action: request.action,
      scope: request.scope,
      metadata: request.metadata
    });
    return {
      authorized: result.authorized as boolean,
      tier: result.tier as string,
      reason: result.reason as string | undefined,
      auditId: result.auditId as string,
      capsule: 'PermissionRouter'
    };
  }
}
