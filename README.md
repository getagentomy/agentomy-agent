# Agentomy Agent

<sub>An open piece of **[Agentomy](https://agentomy.com)**, the governance layer for AI agents in regulated enterprises. See the others at [github.com/getagentomy](https://github.com/getagentomy).</sub>

Know what your agents are doing. Stop them when you need to. Prove it happened.

---

## Path 1: Governance Peer (no code, 30 seconds)

Add a governance peer to any AI agent session. No install. No infrastructure. No code.

**Step 1.** Open [`agent.md`](agent.md) from this repo.

**Step 2.** Copy the full contents into your agent's system prompt (Claude, ChatGPT, any agent runtime that accepts system instructions).

**Step 3.** Run your session. The governance peer observes every action, flags risks in real time, and scores your session against GovernanceBench -- 5 dimensions of what good agent governance looks like.

**What you get:** Authorization checks, behavioral integrity monitoring, EU AI Act flag awareness, OWASP Agentic Top 10 coverage assessment, and a scored summary at session end.

**Score:** 2/5 in standalone mode (Authorization + Behavioral Integrity). The other 3 dimensions (Auditability, Override, OWASP Coverage) require the Agentomy infrastructure layer for cryptographic proof.

**Works with:** Any agent that accepts a system prompt. Claude, ChatGPT, Gemini, Hermes, LangChain agents, CrewAI crews, AutoGen teams. If it has a system prompt, it gets a governance peer.

This is how most people start. No commitment. No accounts. See your governance posture before deciding if you need infrastructure.

---

## Path 2: TypeScript SDK (developers)

For production integration with programmatic governance enforcement.

```bash
npm install agentomy-agent
```

Requires Node.js 18+.

### Standalone (no infrastructure needed)

```typescript
import { GovernancePipeline } from 'agentomy-agent';

const pipeline = new GovernancePipeline();
const result = await pipeline.evaluate({ action: 'data_export', agentId: 'my-agent' });

console.log(result.score);      // 2/5 -- Authorization + Audit
console.log(result.auditTrail); // local SHA-256 hash chain
console.log(result.mode);       // 'standalone'
```

Works immediately. No API keys. No server. No configuration. Real permission enforcement (5-tier model). Real hash-chain audit trail. Your GovernanceBench score: 2/5.

### Connected Mode (5/5 governance)

Connect to the Agentomy platform for the full governance layer -- tamper-evident audit trail, fleet-wide halt, compliance evidence, behavioral monitoring, OWASP coverage.

```typescript
import { GovernancePipeline } from 'agentomy-agent';

const pipeline = new GovernancePipeline({
  endpoint: process.env.AGENTOMY_ENDPOINT,
  token: process.env.AGENTOMY_TOKEN,
  agentId: 'my-agent'
});

const result = await pipeline.evaluate({ action: 'data_export' });
console.log(result.score); // 5/5
```

## 12 Governance Modules

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

## Framework Adapters

The SDK ships with adapters for major agent frameworks:

- LangChain
- LangGraph
- AutoGen
- CrewAI
- Haystack
- Google ADK
- Microsoft Agent
- Semantic Kernel
- Dify
- Flowise
- OpenAI Agents SDK
- Azure AI Foundry
- AWS Bedrock
- Agno
- Hermes
- OpenClaw
- Anthropic SDK
- LlamaIndex
- RPA (vertical)
- Algo Trading (vertical)
- Medical Device (vertical)
- AV Fleet (vertical)
- Industrial IoT (vertical)
- Cloud Infrastructure (vertical)

Import any adapter directly:

```typescript
import { LangChainAdapter } from 'agentomy-agent';
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENTOMY_ENDPOINT` | Governance server URL | `http://localhost:3000` |
| `AGENTOMY_TOKEN` | API authentication token | `demo` |
| `AGENTOMY_AGENT_ID` | Default agent identifier | `default-agent` |

Environment variables are used as fallbacks when no config is passed to the constructor.

## TypeScript Support

Ships with `.d.ts` type declarations. No additional `@types` package needed.

## Status

MIT licensed. Standalone mode works immediately (2/5 governance). Full governance (5/5) requires Agentomy platform.

## Links

- Website: https://agentomy.com
- GovernanceBench: https://agentomy.com/governancebench
- Python SDK: https://pypi.org/project/agentomy
