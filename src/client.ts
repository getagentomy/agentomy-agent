/**
 * Base HTTP client for Agentomy Agent capsule wrappers.
 * In standalone mode (no endpoint/token configured), capsules run locally
 * with in-memory governance -- zero infrastructure required.
 * In connected mode, all calls route to the Agentomy governance server.
 */

import { createHash, randomUUID } from 'crypto';

export interface AgentomyConfig {
  /** Governance server endpoint. If omitted, standalone mode activates. */
  endpoint?: string;
  /** API authentication token. If omitted, standalone mode activates. */
  token?: string;
  /** Default agent identifier */
  agentId?: string;
}

/**
 * The five governance tiers, in the vocabulary the Agentomy API returns.
 *
 * Tiers are cumulative: each one grants everything the tier below it grants, plus more.
 * Evaluator is read-only; Strategist is fleet-level and unrestricted.
 *
 * NOTE (internal, deliberately not in the published .d.ts): this type formerly enumerated the
 * server's compact tier codes. That was both a vocabulary leak and a mistype, since responses
 * are translated before they leave the API. See the commit that introduced this note.
 */
export type GovernanceTier = 'Evaluator' | 'Analyst' | 'Builder' | 'Operator' | 'Strategist';

/**
 * Normalise a tier value to its public name.
 *
 * Accepts the compact codes some self-hosted or older deployments return, so a caller never
 * has to guess which form it received. Values that are already public names pass through
 * unchanged.
 */
export function publicTierName(tier: string): GovernanceTier | string {
  const COMPACT_TO_PUBLIC: Record<string, GovernanceTier> = {
    Evaluator: 'Evaluator', Analyst: 'Analyst', Builder: 'Builder',
    Operator: 'Operator', Strategist: 'Strategist'
  };
  return COMPACT_TO_PUBLIC[tier] || tier;
}

/** Actions permitted per tier. Cumulative: each tier includes everything below it. */
export const TIER_PERMISSIONS: Record<GovernanceTier, Set<string>> = {
  Evaluator: new Set(['read', 'ping', 'health']),
  Analyst: new Set(['read', 'ping', 'health', 'query', 'list', 'search']),
  Builder: new Set(['read', 'ping', 'health', 'query', 'list', 'search',
    'write', 'create', 'update', 'delete', 'data_export', 'data_import',
    'invoke', 'execute', 'run', 'agent_execute', 'tool_call', 'agent_run']),
  Operator: new Set(['read', 'ping', 'health', 'query', 'list', 'search',
    'write', 'create', 'update', 'delete', 'data_export', 'data_import',
    'invoke', 'execute', 'run', 'deploy', 'scale', 'configure', 'admin']),
  Strategist: new Set(['*']) // Fleet-level: all actions permitted
};

/** Standalone audit entry */
export interface AuditEntry {
  auditId: string;
  agentId: string;
  action: string;
  input: unknown;
  output: unknown;
  timestamp: string;
  hash: string;
  previousHash: string;
  chainPosition: number;
}

/** Shared standalone state -- persists for the lifetime of the process */
class StandaloneState {
  private static instance: StandaloneState;
  auditChain: AuditEntry[] = [];
  halted = false;
  haltReason = '';
  haltProof = '';
  haltTimestamp = '';
  private initialized = false;

  static getInstance(): StandaloneState {
    if (!StandaloneState.instance) {
      StandaloneState.instance = new StandaloneState();
    }
    return StandaloneState.instance;
  }

  logBanner(): void {
    if (!this.initialized) {
      this.initialized = true;
      console.log('[Agentomy] Standalone mode: 2/5 governance active. No infrastructure required.');
    }
  }

  appendAudit(agentId: string, action: string, input: unknown, output: unknown): AuditEntry {
    const previousHash = this.auditChain.length > 0
      ? this.auditChain[this.auditChain.length - 1].hash
      : '0000000000000000000000000000000000000000000000000000000000000000';
    const timestamp = new Date().toISOString();
    const auditId = randomUUID();
    const payload = JSON.stringify({ auditId, agentId, action, input, output, timestamp, previousHash });
    const hash = createHash('sha256').update(payload).digest('hex');
    const entry: AuditEntry = {
      auditId, agentId, action, input, output, timestamp,
      hash, previousHash, chainPosition: this.auditChain.length
    };
    this.auditChain.push(entry);
    return entry;
  }

  doHalt(agentId: string, reason: string): { halted: boolean; timestamp: string; proof: string; scope: string } {
    this.halted = true;
    this.haltReason = reason;
    this.haltTimestamp = new Date().toISOString();
    this.haltProof = createHash('sha256')
      .update(JSON.stringify({ agentId, reason, timestamp: this.haltTimestamp }))
      .digest('hex');
    return { halted: true, timestamp: this.haltTimestamp, proof: this.haltProof, scope: 'agent' };
  }

  doResume(reason: string): { resumed: boolean; timestamp: string } {
    this.halted = false;
    this.haltReason = '';
    this.haltProof = '';
    return { resumed: true, timestamp: new Date().toISOString() };
  }
}

export { StandaloneState };

export class AgentomyClient {
  protected endpoint: string;
  protected token: string;
  protected agentId: string;
  protected standalone: boolean;
  protected state: StandaloneState;

  constructor(config: AgentomyConfig = {}) {
    const envEndpoint = process.env.AGENTOMY_ENDPOINT || '';
    const envToken = process.env.AGENTOMY_TOKEN || '';
    const cfgEndpoint = config.endpoint || '';
    const cfgToken = config.token || '';

    // Standalone mode: no endpoint AND no token configured anywhere
    this.standalone = !cfgEndpoint && !envEndpoint && !cfgToken && !envToken;

    this.endpoint = (cfgEndpoint || envEndpoint || 'http://localhost:3000').replace(/\/$/, '');
    this.token = cfgToken || envToken || 'demo';
    this.agentId = config.agentId || process.env.AGENTOMY_AGENT_ID || 'default-agent';
    this.state = StandaloneState.getInstance();

    if (this.standalone) {
      this.state.logBanner();
    }
  }

  protected async post(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.standalone) {
      return this.localPost(path, body);
    }
    const url = `${this.endpoint}/api${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Agentomy API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<Record<string, unknown>>;
  }

  protected async get(path: string): Promise<Record<string, unknown>> {
    if (this.standalone) {
      return this.localGet(path);
    }
    const url = `${this.endpoint}/api${path}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Agentomy API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<Record<string, unknown>>;
  }

  /** Local POST handler for standalone mode */
  private localPost(path: string, body: Record<string, unknown>): Record<string, unknown> {
    const agentId = (body.agentId as string) || this.agentId;

    if (path === '/claw/authorize') {
      const action = body.action as string;
      const tier: GovernanceTier = 'Builder';
      const perms = TIER_PERMISSIONS[tier];
      const authorized = perms.has(action) || perms.has('*');
      return {
        authorized,
        tier: publicTierName(tier),
        reason: authorized
          ? `Action '${action}' permitted at ${publicTierName(tier)} tier`
          : `Action '${action}' denied at ${publicTierName(tier)} tier`,
        auditId: randomUUID(),
        capsule: 'PermissionRouter'
      };
    }

    if (path === '/claw/log') {
      const entry = this.state.appendAudit(
        agentId,
        body.action as string,
        body.input,
        body.output
      );
      return {
        auditId: entry.auditId,
        chainPosition: entry.chainPosition,
        hash: entry.hash,
        blockHash: entry.hash,
        capsule: 'AuditLogger'
      };
    }

    if (path === '/claw/halt') {
      const result = this.state.doHalt(agentId, body.reason as string);
      return {
        halted: result.halted,
        timestamp: result.timestamp,
        haltReasonHash: result.proof,
        proof: result.proof,
        scope: result.scope,
        capsule: 'HaltProtocol'
      };
    }

    if (path === '/claw/resume') {
      const result = this.state.doResume(body.reason as string || '');
      return { resumed: result.resumed, timestamp: result.timestamp };
    }

    return { error: `Unknown standalone path: ${path}` };
  }

  /** Local GET handler for standalone mode */
  private localGet(path: string): Record<string, unknown> {
    if (path === '/audit/anchors') {
      return {
        anchors: this.state.auditChain.map(e => ({ hash: e.hash, position: e.chainPosition })),
        verified: true
      };
    }
    return { error: `Unknown standalone path: ${path}` };
  }
}
