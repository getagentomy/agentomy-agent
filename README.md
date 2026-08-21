<div align="center">
  <img src="https://agentomy.com/agentomy-logo-dark.svg" alt="Agentomy" width="320" />
</div>

# Agentomy Agent

<sub>An open piece of **[Agentomy](https://agentomy.com)**, the vendor-neutral governance layer for AI agents. See the others at [github.com/getagentomy](https://github.com/getagentomy).</sub>

**Governance for your agent sessions in 30 seconds. Free forever. No infrastructure, no account, no API key.**

![license](https://img.shields.io/badge/license-MIT-orange) ![price](https://img.shields.io/badge/price-free%20forever-brightgreen) ![install](https://img.shields.io/badge/install-30%20seconds-brightgreen) ![infra](https://img.shields.io/badge/infrastructure-none-blue) ![frameworks](https://img.shields.io/badge/frameworks-any-blue) ![benchmark](https://img.shields.io/badge/scored%20by-GovernanceBench-blue) ![npm](https://img.shields.io/badge/npm-agentomy--agent-red) ![pypi](https://img.shields.io/badge/pypi-agentomy-blue)

<div align="center">

**[AGENTOMY.COM](https://agentomy.com)** &nbsp;·&nbsp; **[Peer (no code)](#path-1-governance-peer-no-code-30-seconds)** &nbsp;·&nbsp; **[SDK](#path-2-typescript-sdk-developers)** &nbsp;·&nbsp; **[Free vs Connected](#what-you-get-free-what-connecting-adds)**

</div>

---

## Governance belongs before the action, not after it

Every AI agent takes actions on someone's behalf. It reads, writes, calls tools, moves data, and speaks to other systems. The important question is never only *what did it do*, because the logs can tell you that. It is whether anyone **authorized** the action, whether the record of it can be **proven** to a third party, and whether a human can **stop** it. Governance is the discipline of being able to answer those three questions.

Most teams reach for governance the way they reach for a fire extinguisher: after something is already burning. They deploy agents, and only when a customer's security review, a regulator, or an incident forces the question do they go looking for what those agents have been doing. This is **discovery after the fact**, and it has a structural flaw. By the time an audit surfaces an ungoverned action, the action has already been taken. The refund already went out. The record already left the building. The scope was already exceeded. Discovery tells you the history of a problem; it does not prevent one.

Prevention is different. Prevention means governance is *present at the point of action*, observing, assessing, and flagging as the agent works, so a gap is caught while it is still a gap and not yet an incident. That is not an enterprise luxury. It is as true for a single personal agent as for a fleet of a thousand: the scale changes the infrastructure, it does not change the principle. An agent that can act without authorization, without a record, and without an off switch is ungoverned whether there is one of them or a thousand.

**Agentomy Agent exists to make prevention the default, at any scale, for anyone running agents.** It is the smallest possible starting point, so governance can be present from the *first* agent rather than retrofitted after the thousandth.

## Who this is for

- **The Claw community and other open agent runtimes.** If you build on OpenClaw, Hermes, or any open runtime, governance should not require you to change your framework. Agentomy Agent wraps around your agents; you keep your code.
- **Individual developers and small businesses.** You do not need a security department to govern the agents you already run. The free tier gives you discovery, permission limits, and an audit posture on your own machine or small team, with no paid plan required.
- **Anyone deploying agents who wants to know their posture before it matters.** Whether you are new to agent governance or already in production, this is a first-principles instrument: it tells you, in plain language, where your governance stands and what to fix first.

## What Agentomy Agent is

Agentomy Agent is a governance peer that runs *inside* your agent team. It observes every action, assesses your governance posture in real time, flags risks as they appear, and scores the session against **GovernanceBench**, the open, reproducible benchmark for what good agent governance looks like. It does not slow your agents down, block actions, or modify behavior. It sits alongside them and watches, and at the end hands you a scored, specific summary.

This is an architectural distinction, not a marketing one. Every other governance product sits *outside* the agent team, a separate system your agents report to, observing them from a distance and after the fact. A peer sits *inside*, at the point of action. That is why it installs in thirty seconds with nothing to deploy, and why prevention, not just discovery, is possible from the very first session.

There are two ways to use it: a **no-code governance peer** (a system prompt) and a **TypeScript SDK** for programmatic use. Both run free in standalone mode.

---

## Path 1: Governance Peer (no code, 30 seconds)

Add a governance peer to any AI agent session. No install. No infrastructure. No code.

**Step 1.** Open [`agent.md`](agent.md) from this repo.
**Step 2.** Copy the full contents into your agent's system prompt (Claude, ChatGPT, or any runtime that accepts system instructions). For Claude Code, copy the `agentomy-agent/` folder into `.claude/skills/`; it activates automatically.
**Step 3.** Run your session. The peer observes every action, flags risks in real time, and scores the session against GovernanceBench.

**Works with** any agent that accepts a system prompt: Claude, ChatGPT, Gemini, Hermes, OpenClaw, LangChain, CrewAI, AutoGen. If it has a system prompt, it gets a governance peer. This is how most people start: no commitment, no accounts, see your posture before deciding whether you need infrastructure.

## Path 2: TypeScript SDK (developers)

For production integration with programmatic governance.

```bash
npm install agentomy-agent
```

Requires Node.js 18+. A Python SDK is also published: [`pypi.org/project/agentomy`](https://pypi.org/project/agentomy).

### Standalone (no infrastructure needed)

```typescript
import { GovernancePipeline } from 'agentomy-agent';

const pipeline = new GovernancePipeline();
const result = await pipeline.evaluate({ action: 'data_export', agentId: 'my-agent' });

console.log(result.score);      // 3/6 in standalone: Authorization, Behavioral, Audit
console.log(result.auditTrail); // local SHA-256 hash chain
console.log(result.mode);       // 'standalone'
```

Works immediately. No API keys, no server, no configuration. Real permission enforcement (the 5-tier model), a real hash-chain audit trail, and your GovernanceBench score: 3/6.

### Connected Mode (graded and proved by the platform)

Connect to the Agentomy platform (self-hosted or hosted) for the full governance layer: tamper-evident audit trail, fleet-wide halt, compliance evidence, behavioral monitoring, and OWASP coverage.

```typescript
import { GovernancePipeline } from 'agentomy-agent';

const pipeline = new GovernancePipeline({
  endpoint: process.env.AGENTOMY_ENDPOINT,
  token: process.env.AGENTOMY_TOKEN,
  agentId: 'my-agent'
});

const result = await pipeline.evaluate({ action: 'data_export' });
console.log(result.score); // graded by the connected platform, up to 6/6
```

The connected score and the evidence behind it come from the platform, not from the local SDK. The standalone agent tops out at 3/6 by design: observation can score and flag, but only the connected infrastructure can enforce and produce proof a third party can independently verify. That is the line between the free tier and the paid tiers.

---

## Why the free tier is genuinely useful

Free here is not a teaser with the good parts removed. On day one, at no cost and with no infrastructure, you get:

- **A real governance posture score** for every session, against an open benchmark. Not a vanity number.
- **Specific, live flags** the moment a risk appears, each pointing at a concrete fix.
- **A second pair of eyes during development** that catches gaps a busy engineer misses, before they reach production.
- **A score you can show** a customer's security team or your own leadership, before you have spent a dollar.
- **Zero lock-in.** It is a system prompt, or an SDK you own. Model-agnostic, framework-agnostic, and nothing leaves your session.

For many teams, awareness is the right first step, and awareness is exactly what the free tier delivers. You move up to infrastructure when you need to *prove* something to someone outside your team, not before.

## A real session

A healthcare startup is building an AI assistant for clinical documentation. Before deploying to their first hospital, they want to know whether there are governance gaps, without standing up infrastructure. They install Agentomy Agent in thirty seconds. In the first session the peer surfaces three things: an agent requesting patient records outside its declared scope; no human-override mechanism, so nothing can be stopped cleanly; and output that is not scanned for sensitive data before it reaches a clinician. The score is **3/6** in standalone mode, not a failure but an honest picture. They fix all three *before* deploying, then connect the infrastructure for proof the hospital's security team can verify. That is prevention doing its job: the gaps were closed while they were still gaps.

## Understanding your score

Agentomy Agent produces a GovernanceBench score after every session. It reflects your **governance posture**, not your agent's intelligence or output quality.

| Score | Mode | What it means |
|---|---|---|
| **3/6** | Standalone (free) | The peer can observe, flag, and score across Authorization, Behavioral Integrity, and Auditability (via a local tamper-evident hash chain). It cannot cryptographically attest or enforce. This is the honest ceiling for observation alone: you can *see*, but you cannot yet *prove* to a third party. |
| **6/6** | Connected | The peer connects to the Agentomy infrastructure and adds Override, OWASP Coverage, and Message Governance with cryptographic evidence chains and audit-grade proof. Observation becomes evidence. |

Every flag is specific. Every recommendation points at a concrete action. The score is honest because the methodology is open.

## The GovernanceBench dimensions

- **Authorization.** Is the agent operating within its permitted boundaries? *(EU AI Act Art. 9; SOC 2 access controls)*
- **Auditability.** Does the session produce a reviewable, tamper-evident record of what happened and why? Application logs showing HTTP 200s are not an audit trail. *(EU AI Act Art. 12; SOC 2 audit logging)*
- **Override.** Can a human halt or redirect the agent immediately, with one command, confirmed, surviving restart? Not "file a ticket." *(EU AI Act Art. 14; HIPAA administrative controls)*
- **Behavioral.** Is the agent staying within its guardrails and not drifting from its own baseline? *(EU AI Act Art. 9 ongoing risk management)*
- **OWASP Coverage.** Are known agent attacks addressed, tested against the open Kevlar adversarial benchmark? *(OWASP Agentic Top 10; MITRE ATLAS)*

## What you get free, what connecting adds

The free agent is fully useful on its own. Connecting the infrastructure is about **proof and enforcement**, the things a system prompt cannot do by itself.

| Capability | Standalone (free) | Connected (Pro / Enterprise) |
|---|---|---|
| Observe agent actions in real time | Yes | Yes |
| Score posture against GovernanceBench | Yes | Yes |
| Flag risks live during the session | Yes | Yes |
| Scored summary at session end | Yes | Yes |
| Local hash-chain audit trail | Yes | Yes |
| Cryptographic, tamper-evident evidence chain | No | Yes |
| Persistent audit trail | No | Yes |
| Fleet kill switch, halt every agent instantly | No | Yes |
| Tier-based access control | No | Yes |
| Compliance export (EU AI Act, SOC 2, HIPAA, ISO 27001) | No | Yes |
| Audit trail third parties can verify | No | Yes |
| Infrastructure required | none | Docker (3-command install) |
| Cost | **Free forever** | See [agentomy.com/pricing](https://agentomy.com/pricing) |

## 12 governance modules (SDK)

| Module | Purpose |
|--------|---------|
| PermissionRouter | Access control for agent actions |
| AuditLogger | Tamper-evident audit trail |
| HaltProtocol | Emergency halt |
| ExecutionTimer | Runtime boundaries and timeouts |
| AgentSandbox | Containment and isolation |
| DecisionLog | Decision transparency |
| TraceBinding | Output traceability |
| TeamCoordinator | Multi-agent orchestration |
| EthicsConstraint | Ethics enforcement |
| TrustScorer | Behavioral trust scoring |
| RuntimeMonitor | Observability and telemetry |
| DeploymentManifest | Governance transparency |

Each module can be used standalone or composed through the `GovernancePipeline`.

## Framework adapters

Governance wraps around the framework you already use. Import any adapter directly (`import { LangChainAdapter } from 'agentomy-agent';`):

LangChain, LangGraph, AutoGen, CrewAI, Haystack, Google ADK, Microsoft Agent, Semantic Kernel, Dify, Flowise, OpenAI Agents SDK, Azure AI Foundry, AWS Bedrock, Agno, **Hermes**, **OpenClaw**, Anthropic SDK, and LlamaIndex, plus vertical adapters for RPA, Algo Trading, Medical Device, AV Fleet, Industrial IoT, and Cloud Infrastructure.

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENTOMY_ENDPOINT` | Governance server URL | `http://localhost:3000` |
| `AGENTOMY_TOKEN` | API authentication token | `demo` |
| `AGENTOMY_AGENT_ID` | Default agent identifier | `default-agent` |

Used as fallbacks when no config is passed to the constructor. Ships with `.d.ts` type declarations, so no extra `@types` package is needed.

## Honest limits

- **What the standalone peer does, and does not, do.** The standalone peer is an observation layer, not an enforcement perimeter. Like any control expressed as a system prompt, a determined adversary can attempt to talk it out of its job. That is not a defect to hide; it is the exact reason enforcement that cannot be prompted away belongs one layer down, in infrastructure. Standalone gives you awareness. Connected mode gives you enforcement the model cannot argue with, and cryptographic proof a third party can check. It flags persona-override attempts either way.
- **Does it slow agents down?** No. It observes; it does not intercept or modify the execution path.
- **Does a 3/6 mean my governance is bad?** No. A 3/6 is the accurate score for observation without infrastructure. If your use case needs proof, 3/6 is telling you exactly that.

## The verification principle

We do not ask you to trust our claims. We ask you to verify them. Run [GovernanceBench](https://github.com/getagentomy/governancebench) on your own session and see what it finds. The score is honest because the methodology is open. If it does not match what you observe, tell us: governance@agentomy.com.

## The rest of Agentomy

- **[GovernanceBench](https://github.com/getagentomy/governancebench):** the open, reproducible benchmark that scores you.
- **[VIGIL](https://github.com/getagentomy/vigil):** the open adversarial and prompt-injection battery.
- **[MCP Gateway](https://github.com/getagentomy/mcp-gateway):** governed MCP access in a few lines of config.
- **[WorkflowBench](https://github.com/getagentomy/workflowbench):** the workflow-governance benchmark.
- **[agentomy.com](https://agentomy.com):** the platform, pricing, and docs.

---

<sub>governance@agentomy.com &nbsp;·&nbsp; [agentomy.com](https://agentomy.com) &nbsp;·&nbsp; MIT licensed. Standalone mode works immediately (3/6). Full governance (6/6) requires the Agentomy platform. All evaluation evidence is available for independent verification.</sub>
