/**
 * IngestSourceAdjudicator -- Indirect Prompt Injection (IPI) detection at
 * data-ingestion time. Closes the agent-jacking class disclosed by Tenet
 * Security (June 2026): malicious markdown in Sentry events / GitHub issues
 * / MCP server responses / Stack Overflow answers ingested by AI coding
 * agents and treated as legitimate instructions by the model.
 *
 * Architecture: standalone local linter. Runs BEFORE content reaches the LLM
 * context window. Pure deterministic detection -- no network round-trip.
 * Parallel to PermissionRouter (which runs at action-execution time).
 * Server-side audit attestation is a separate capsule (DataSourceAttestation,
 * Phase 1.2).
 *
 * Closes the structural gap behind: Tenet Sentry MCP poisoning,
 * HiddenLayer GitHub README hidden-comment hijack, Backslash Cursor
 * `$()` command-substitution bypass, OWASP skill-file silent SSH exfil.
 */

export type SourceTrust = 'trusted' | 'external_untrusted' | 'unknown';

export interface IngestSource {
  /** Full URI of the data source, if available (https://, sentry://, mcp://, file://, ...). */
  uri?: string;
  /** Logical channel identifier when no URI is available. */
  channel?: string;
  /** Explicit trust override. Caller-supplied wins over inferred classification. */
  trust?: SourceTrust;
}

export type IpiPatternId =
  | 'unicode_tag_block'
  | 'zero_width_cluster'
  | 'html_comment_directive'
  | 'instruction_override_phrase'
  | 'control_token_shape'
  | 'base64_payload'
  | 'markdown_code_command';

export interface IpiFinding {
  pattern: IpiPatternId;
  /** Matched substring, truncated to 80 chars. */
  match: string;
  /** Byte offset of the match in the original content. */
  position: number;
  severity: 'low' | 'medium' | 'high';
}

export interface AdjudicationResult {
  source: IngestSource;
  trustClassification: SourceTrust;
  findings: IpiFinding[];
  verdict: 'allow' | 'flag' | 'hold';
  capsule: 'IngestSourceAdjudicator';
  reason?: string;
}

const TRUNCATE_LEN = 80;
const ZW_CLUSTER_THRESHOLD = 3;
const BASE64_MIN_LEN = 40;

// Source classification tables (inferred when explicit trust is not supplied).
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

// Detection regexes. Each pattern returns at most one finding per scan so the
// verdict surface remains compact; consumers can re-scan finer-grained.

// U+E0000-U+E007F: Unicode "tag" block -- invisible glyphs originally for
// language tags, weaponized for invisible LLM payloads (HiddenLayer 2025).
const UNICODE_TAG_BLOCK = /[\u{E0000}-\u{E007F}]/u;

// Zero-width characters that together form an invisible cluster.
// Single occurrences are common (encoding artifacts); 3+ in proximity is a signal.
const ZERO_WIDTH_CHARS = /[​‌‍﻿]/g;

// HTML comment containing a directive verb (ignore/disregard/run/curl/...) inside.
const HTML_COMMENT_DIRECTIVE = /<!--[\s\S]{0,500}?\b(ignore|disregard|forget|exfiltrate|execute|run|curl|wget|rm\s+-rf|attacker|c2\b|reverse[- ]?shell)\b[\s\S]{0,500}?-->/i;

// Direct override phrases. Broad-recall: lots of false-positive language might
// trip this; that's the point. Detection runs at ingest, verdict is HOLD not BLOCK.
// VIGIL-146 (AO-002) surfaced that the prior `forget` alt did not catch
// "forget all previous instructions" because the "all" qualifier was only
// in the `ignore` alt. Aligned `forget` alt to parallel structure: optional
// (all|everything|the) qualifier + (above|previous|prior|that) noun + optional
// (instructions|directives|context|prompts|rules) tail.
const INSTRUCTION_OVERRIDE_PHRASE =
  /\b(ignore\s+(all\s+)?(the\s+)?(previous|prior|above)\s+(instructions|directives|context|prompts|rules)|disregard\s+(the\s+|all\s+)?(above|previous|prior)|forget\s+(all\s+|everything\s+|the\s+)?(above|previous|prior|that)(\s+(instructions|directives|context|prompts|rules))?|new\s+(system\s+)?instructions[:\s]|override\s+(your\s+)?(previous|prior|original)\s+instructions)/i;

// Control-token shapes that hint at attempted role-elevation:
// ChatML/Claude/OpenAI/Anthropic delimiters + bracketed role claims.
const CONTROL_TOKEN_SHAPE =
  /(<\|im_(start|end)\|>|<\|endoftext\|>|<\|fim_(begin|hole|end)\|>|<\/?(user_query|system|assistant|user|developer|tool)>)/i;

// Long base64 run. Post-filtered for mixed case to avoid SHA / hex false positives.
const BASE64_RUN = new RegExp(`[A-Za-z0-9+/]{${BASE64_MIN_LEN},}={0,2}`);

// Markdown code block containing a shell command shape. Uses bare-token
// word boundaries so `curl -s ...` matches (the prior `curl\s+...\b` form
// failed when the next char after the trailing space was a hyphen, since
// \b requires a word/non-word transition that does not exist between space
// and `-`). VIGIL-142 surfaced this.
const MARKDOWN_CODE_COMMAND =
  /```[\w-]*\s*\n[\s\S]*?(\b(curl|wget|nc|bash|eval|exec|powershell|iex|Invoke-Expression)\b|\brm\s+-rf\b)[\s\S]*?```/i;

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function hasMixedCase(s: string): boolean {
  return /[A-Z]/.test(s) && /[a-z]/.test(s);
}

export class IngestSourceAdjudicator {
  classifySource(source: IngestSource): SourceTrust {
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
      const ch = source.channel.trim();
      if (TRUSTED_CHANNELS.has(ch)) {
        return 'trusted';
      }
      if (UNTRUSTED_CHANNELS.has(ch)) {
        return 'external_untrusted';
      }
    }
    return 'unknown';
  }

  detect(content: string): IpiFinding[] {
    if (!content) {
      return [];
    }
    const findings: IpiFinding[] = [];

    // 1. Unicode tag block (high severity -- invisible payload, no legitimate use)
    const tagMatch = content.match(UNICODE_TAG_BLOCK);
    if (tagMatch && tagMatch.index !== undefined) {
      findings.push({
        pattern: 'unicode_tag_block',
        match: truncate(tagMatch[0], TRUNCATE_LEN),
        position: tagMatch.index,
        severity: 'high',
      });
    }

    // 2. Zero-width cluster (medium -- 3+ together is signal; isolated is noise)
    const zwMatches = content.match(ZERO_WIDTH_CHARS);
    if (zwMatches && zwMatches.length >= ZW_CLUSTER_THRESHOLD) {
      // Position: index of first ZW char
      const firstZw = content.search(ZERO_WIDTH_CHARS);
      findings.push({
        pattern: 'zero_width_cluster',
        match: `cluster of ${zwMatches.length} zero-width chars`,
        position: firstZw >= 0 ? firstZw : 0,
        severity: 'medium',
      });
    }

    // 3. HTML comment with directive (high -- explicit hide-from-human pattern)
    const commentMatch = content.match(HTML_COMMENT_DIRECTIVE);
    if (commentMatch && commentMatch.index !== undefined) {
      findings.push({
        pattern: 'html_comment_directive',
        match: truncate(commentMatch[0], TRUNCATE_LEN),
        position: commentMatch.index,
        severity: 'high',
      });
    }

    // 4. Instruction override phrase (high -- classic IPI shape)
    const overrideMatch = content.match(INSTRUCTION_OVERRIDE_PHRASE);
    if (overrideMatch && overrideMatch.index !== undefined) {
      findings.push({
        pattern: 'instruction_override_phrase',
        match: truncate(overrideMatch[0], TRUNCATE_LEN),
        position: overrideMatch.index,
        severity: 'high',
      });
    }

    // 5. Control token shape (high -- attempted role-elevation)
    const ctrlMatch = content.match(CONTROL_TOKEN_SHAPE);
    if (ctrlMatch && ctrlMatch.index !== undefined) {
      findings.push({
        pattern: 'control_token_shape',
        match: truncate(ctrlMatch[0], TRUNCATE_LEN),
        position: ctrlMatch.index,
        severity: 'high',
      });
    }

    // 6. Long base64 payload (medium -- benign uses exist; mixed-case filter
    //    removes most SHA/hex false positives)
    const b64Match = content.match(BASE64_RUN);
    if (b64Match && b64Match.index !== undefined && hasMixedCase(b64Match[0])) {
      findings.push({
        pattern: 'base64_payload',
        match: truncate(b64Match[0], TRUNCATE_LEN),
        position: b64Match.index,
        severity: 'medium',
      });
    }

    // 7. Markdown code block with shell exfiltration shape (high)
    const cmdMatch = content.match(MARKDOWN_CODE_COMMAND);
    if (cmdMatch && cmdMatch.index !== undefined) {
      findings.push({
        pattern: 'markdown_code_command',
        match: truncate(cmdMatch[0], TRUNCATE_LEN),
        position: cmdMatch.index,
        severity: 'high',
      });
    }

    return findings;
  }

  adjudicate(content: string, source: IngestSource): AdjudicationResult {
    const trustClassification = this.classifySource(source);
    const findings = this.detect(content);
    const verdict = this._verdict(trustClassification, findings);
    const reason = this._reason(trustClassification, findings, verdict);
    return {
      source,
      trustClassification,
      findings,
      verdict,
      capsule: 'IngestSourceAdjudicator',
      reason,
    };
  }

  private _verdict(trust: SourceTrust, findings: IpiFinding[]): 'allow' | 'flag' | 'hold' {
    if (findings.length === 0) {
      return 'allow';
    }
    // Default-deny on untrusted or unknown sources when IPI patterns surface.
    if (trust === 'external_untrusted' || trust === 'unknown') {
      return 'hold';
    }
    // Trusted source with IPI findings is a surprise -- audit, do not block.
    return 'flag';
  }

  private _reason(trust: SourceTrust, findings: IpiFinding[], verdict: string): string | undefined {
    if (verdict === 'allow') {
      return undefined;
    }
    const patternList = Array.from(new Set(findings.map((f) => f.pattern))).join(', ');
    if (verdict === 'hold') {
      return `Source classified as ${trust}; ${findings.length} IPI pattern(s) detected (${patternList}). HITL approval required before subsequent actions in this conversation.`;
    }
    return `Source classified as ${trust} but ${findings.length} IPI pattern(s) detected (${patternList}). Audit-worthy anomaly; proceeding with elevated logging.`;
  }
}

export default IngestSourceAdjudicator;
