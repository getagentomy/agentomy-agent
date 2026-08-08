/**
 * DataSourceAttestation -- Cryptographic hash-chain attestation of INBOUND
 * data lineage. Phase 1.2 of the agentjacking defense build (Tenet Security
 * disclosure, June 2026).
 *
 * Mirrors the platform's existing audit hash-chain but
 * applied to the agent's data-ingestion path instead of outbound decisions.
 * Closes the forensic gap behind "no malware signature, no suspicious login"
 * -- when an unexpected exfiltration is detected, the chain reveals exactly
 * which external source contained the injection payload.
 *
 * Chain protocol:
 *   sha256(previousHash | recordId | timestamp | sourceKey | contentHash | trustClassification)
 *
 * Parallel layer to IngestSourceAdjudicator (Phase 1.1, runtime verdict)
 * and to PermissionRouter (action-time adjudication). Adjudication verdict
 * can be attached to the attestation record via context for end-to-end
 * audit linkage.
 */

import { createHash, randomUUID } from 'crypto';

export type SourceTrust = 'trusted' | 'external_untrusted' | 'unknown';

export interface AttestationSource {
  uri?: string;
  channel?: string;
  trust?: SourceTrust;
}

export interface AttestationContext {
  agentId?: string;
  conversationId?: string;
  adjudicationVerdict?: 'allow' | 'flag' | 'hold';
}

export interface AttestationRecord {
  recordId: string;
  sourceUri?: string;
  sourceChannel?: string;
  trustClassification: SourceTrust;
  contentHash: string;
  contentLength: number;
  timestamp: string;
  agentId?: string;
  conversationId?: string;
  adjudicationVerdict?: 'allow' | 'flag' | 'hold';
  previousRecordHash?: string;
  recordHash: string;
}

export interface ChainStatus {
  valid: boolean;
  length: number;
  brokenAt?: number;
  brokenReason?: string;
}

export interface ChainQuery {
  sourceUri?: string;
  sourceChannel?: string;
  trustClassification?: SourceTrust;
  agentId?: string;
  conversationId?: string;
  since?: string;
  limit?: number;
}

export interface ConstructorOpts {
  clock?: () => string;
  idGenerator?: () => string;
}

const sha256 = (input: string): string =>
  createHash('sha256').update(input).digest('hex');

// Source classification tables -- intentionally duplicated from
// IngestSourceAdjudicator to keep the two capsules independently testable
// and deployable. Consumers wiring both can call adjudicator.classifySource
// and pass the result via source.trust override to skip re-classification.
const UNTRUSTED_URI_PATTERNS: RegExp[] = [
  /^https?:\/\/github\.com\//i,
  /^https?:\/\/raw\.githubusercontent\.com\//i,
  /^https?:\/\/.*\.github\.io\//i,
  /^https?:\/\/stackoverflow\.com\//i,
  /^https?:\/\/.*\.stackexchange\.com\//i,
  /^sentry:\/\//i,
  /^https?:\/\/.*\.sentry\.io\//i,
  /^mcp:\/\//i,
  /^https?:\/\/.*\.atlassian\.net\//i,
];

const UNTRUSTED_CHANNELS = new Set([
  'github_issue',
  'github_pr',
  'github_readme',
  'sentry_event',
  'mcp_server',
  'mcp_resource',
  'stackoverflow',
  'web_fetch',
  'external_api',
]);

const TRUSTED_CHANNELS = new Set([
  'user_typed',
  'local_file',
  'project_source',
  'governed_attestation',
]);

function classifySource(source: AttestationSource): SourceTrust {
  if (source.trust) {
    return source.trust;
  }
  if (source.uri) {
    const uri = source.uri.trim();
    if (uri.startsWith('file://')) {
      return 'trusted';
    }
    for (const re of UNTRUSTED_URI_PATTERNS) {
      if (re.test(uri)) {
        return 'external_untrusted';
      }
    }
  }
  if (source.channel) {
    if (TRUSTED_CHANNELS.has(source.channel)) {
      return 'trusted';
    }
    if (UNTRUSTED_CHANNELS.has(source.channel)) {
      return 'external_untrusted';
    }
  }
  return 'unknown';
}

function chainHash(
  previousRecordHash: string | undefined,
  recordId: string,
  timestamp: string,
  sourceKey: string,
  contentHash: string,
  trustClassification: SourceTrust
): string {
  const prev = previousRecordHash || '';
  return sha256(`${prev}|${recordId}|${timestamp}|${sourceKey}|${contentHash}|${trustClassification}`);
}

export class DataSourceAttestation {
  private _records: AttestationRecord[] = [];
  private _clock: () => string;
  private _idGenerator: () => string;

  constructor(opts: ConstructorOpts = {}) {
    this._clock = opts.clock ?? (() => new Date().toISOString());
    this._idGenerator = opts.idGenerator ?? (() => `att_${randomUUID()}`);
  }

  attest(
    content: string,
    source: AttestationSource,
    context: AttestationContext = {}
  ): AttestationRecord {
    const trustClassification = classifySource(source);
    const contentHash = sha256(content);
    const contentLength = content.length;
    const timestamp = this._clock();
    const recordId = this._idGenerator();
    const previousRecordHash = this._records.length > 0
      ? this._records[this._records.length - 1].recordHash
      : undefined;
    const sourceKey = source.uri || source.channel || '';
    const recordHash = chainHash(
      previousRecordHash,
      recordId,
      timestamp,
      sourceKey,
      contentHash,
      trustClassification
    );

    const record: AttestationRecord = {
      recordId,
      sourceUri: source.uri,
      sourceChannel: source.channel,
      trustClassification,
      contentHash,
      contentLength,
      timestamp,
      agentId: context.agentId,
      conversationId: context.conversationId,
      adjudicationVerdict: context.adjudicationVerdict,
      previousRecordHash,
      recordHash,
    };

    this._records.push(record);
    return record;
  }

  verify(record: AttestationRecord): boolean {
    const sourceKey = record.sourceUri || record.sourceChannel || '';
    const recomputed = chainHash(
      record.previousRecordHash,
      record.recordId,
      record.timestamp,
      sourceKey,
      record.contentHash,
      record.trustClassification
    );
    return recomputed === record.recordHash;
  }

  verifyChain(): ChainStatus {
    if (this._records.length === 0) {
      return { valid: true, length: 0 };
    }
    for (let i = 0; i < this._records.length; i++) {
      const rec = this._records[i];
      // Verify previousRecordHash linkage
      const expectedPrev = i === 0 ? undefined : this._records[i - 1].recordHash;
      if (rec.previousRecordHash !== expectedPrev) {
        return {
          valid: false,
          length: this._records.length,
          brokenAt: i,
          brokenReason: `previousRecordHash mismatch at index ${i}`,
        };
      }
      // Verify recordHash integrity
      if (!this.verify(rec)) {
        return {
          valid: false,
          length: this._records.length,
          brokenAt: i,
          brokenReason: `recordHash mismatch at index ${i}`,
        };
      }
    }
    return { valid: true, length: this._records.length };
  }

  query(filter: ChainQuery): AttestationRecord[] {
    let result = this._records.slice();
    if (filter.sourceUri !== undefined) {
      result = result.filter((r) => r.sourceUri === filter.sourceUri);
    }
    if (filter.sourceChannel !== undefined) {
      result = result.filter((r) => r.sourceChannel === filter.sourceChannel);
    }
    if (filter.trustClassification !== undefined) {
      result = result.filter((r) => r.trustClassification === filter.trustClassification);
    }
    if (filter.agentId !== undefined) {
      result = result.filter((r) => r.agentId === filter.agentId);
    }
    if (filter.conversationId !== undefined) {
      result = result.filter((r) => r.conversationId === filter.conversationId);
    }
    if (filter.since !== undefined) {
      const sinceVal = filter.since;
      result = result.filter((r) => r.timestamp >= sinceVal);
    }
    if (filter.limit !== undefined && filter.limit >= 0) {
      result = result.slice(0, filter.limit);
    }
    return result;
  }

  head(): AttestationRecord | null {
    return this._records.length > 0
      ? this._records[this._records.length - 1]
      : null;
  }

  length(): number {
    return this._records.length;
  }

  reset(): void {
    this._records = [];
  }
}

export default DataSourceAttestation;
