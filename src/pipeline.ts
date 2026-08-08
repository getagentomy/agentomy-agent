import { AgentomyConfig, StandaloneState, AuditEntry } from './client';
import { PermissionRouter } from './capsules/PermissionRouter';
import { AuditLogger } from './capsules/AuditLogger';
import { HaltProtocol } from './capsules/HaltProtocol';

export interface GovernanceScore {
  score: string;
  dimensions: {
    authorization: boolean;
    audit: boolean;
    behavioral: boolean;
    override: boolean;
    owasp: boolean;
  };
}

export interface EvaluateResult {
  authorized: boolean;
  tier: string;
  auditTrail: { auditId: string; hash: string; chainPosition: number };
  score: string;
  mode: 'standalone' | 'connected';
  capsules: string[];
}

/**
 * GovernancePipeline -- convenience wrapper for the 4-line quickstart.
 *
 * Standalone mode (default -- no config required):
 *   import { GovernancePipeline } from 'agentomy-agent';
 *   const gov = new GovernancePipeline();
 *   const result = await gov.evaluate({ action: 'data_export', agentId: 'my-agent' });
 *
 * Connected mode (with Agentomy server):
 *   const gov = new GovernancePipeline({ endpoint: 'https://...', token: '...' });
 */
export class GovernancePipeline {
  private router: PermissionRouter;
  private logger: AuditLogger;
  private halt: HaltProtocol;
  private agentId: string;
  private mode: 'standalone' | 'connected';
  private state: StandaloneState;

  constructor(config?: AgentomyConfig) {
    this.router = new PermissionRouter(config);
    this.logger = new AuditLogger(config);
    this.halt = new HaltProtocol(config);
    this.agentId = config?.agentId || process.env.AGENTOMY_AGENT_ID || 'default-agent';

    const envEndpoint = process.env.AGENTOMY_ENDPOINT || '';
    const envToken = process.env.AGENTOMY_TOKEN || '';
    const cfgEndpoint = config?.endpoint || '';
    const cfgToken = config?.token || '';
    this.mode = (!cfgEndpoint && !envEndpoint && !cfgToken && !envToken) ? 'standalone' : 'connected';
    this.state = StandaloneState.getInstance();
  }

  async evaluate(request: { action: string; agentId?: string; scope?: string; metadata?: Record<string, unknown> }): Promise<EvaluateResult> {
    const agentId = request.agentId || this.agentId;

    // Step 1: Permission check
    const auth = await this.router.check({
      agentId,
      action: request.action,
      scope: request.scope,
      metadata: request.metadata
    });

    // Step 2: Log the governance event
    const log = await this.logger.log({
      agentId,
      action: request.action,
      input: { authorized: auth.authorized, tier: auth.tier },
      output: request.metadata
    });

    const score = this.getScore();

    return {
      authorized: auth.authorized,
      tier: auth.tier,
      auditTrail: {
        auditId: log.auditId,
        hash: log.hash,
        chainPosition: log.chainPosition
      },
      score: score.score,
      mode: this.mode,
      capsules: this.mode === 'standalone'
        ? ['PermissionRouter', 'AuditLogger']
        : ['PermissionRouter', 'AuditLogger', 'HaltProtocol', 'ExecutionTimer', 'RuntimeMonitor']
    };
  }

  /** Returns the governance score for the current mode */
  getScore(): GovernanceScore {
    if (this.mode === 'standalone') {
      return {
        score: '2/5',
        dimensions: {
          authorization: true,
          audit: true,
          behavioral: false,
          override: false,
          owasp: false
        }
      };
    }
    return {
      score: '5/5',
      dimensions: {
        authorization: true,
        audit: true,
        behavioral: true,
        override: true,
        owasp: true
      }
    };
  }

  /** Returns the local audit trail (standalone mode only) */
  getAuditTrail(): AuditEntry[] {
    return this.state.auditChain;
  }

  async haltAgent(reason: string): Promise<{ halted: boolean; proof: string }> {
    const result = await this.halt.execute({
      agentId: this.agentId,
      reason
    });
    return { halted: result.halted, proof: result.proof };
  }
}
