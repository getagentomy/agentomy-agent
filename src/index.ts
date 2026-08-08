// Agentomy Agent -- Governed agent framework for enterprise AI
// License: MIT

// Core client
export { AgentomyClient, AgentomyConfig, StandaloneState, GovernanceTier, TIER_PERMISSIONS } from './client';
export type { AuditEntry } from './client';

// Governance pipeline types
export type { GovernanceScore, EvaluateResult } from './pipeline';

// 12 Governance Capsules
export { PermissionRouter } from './capsules/PermissionRouter';
export { AuditLogger } from './capsules/AuditLogger';
export { HaltProtocol } from './capsules/HaltProtocol';
export { ExecutionTimer } from './capsules/ExecutionTimer';
export { AgentSandbox } from './capsules/AgentSandbox';
export { DecisionLog } from './capsules/DecisionLog';
export { TraceBinding } from './capsules/TraceBinding';
export { TeamCoordinator } from './capsules/TeamCoordinator';
export { EthicsConstraint } from './capsules/EthicsConstraint';
export { TrustScorer } from './capsules/TrustScorer';
export { RuntimeMonitor } from './capsules/RuntimeMonitor';
export { DeploymentManifest } from './capsules/DeploymentManifest';

// Convenience: GovernancePipeline
export { GovernancePipeline } from './pipeline';

// Framework Adapters (24 integration points: 18 AI + 6 vertical)
export { BaseAdapter, GovernedAgent, HALT_REASON, ACTION_NAME } from './adapters/base';
export type { HaltReason, ActionName, HaltableWrapped } from './adapters/base';
export { LangChainAdapter } from './adapters/LangChainAdapter';
export { LangGraphAdapter } from './adapters/LangGraphAdapter';
export { AutoGenAdapter } from './adapters/AutoGenAdapter';
export { CrewAIAdapter } from './adapters/CrewAIAdapter';
export { HaystackAdapter } from './adapters/HaystackAdapter';
export { GoogleADKAdapter } from './adapters/GoogleADKAdapter';
export { MicrosoftAgentAdapter } from './adapters/MicrosoftAgentAdapter';
export { SemanticKernelAdapter } from './adapters/SemanticKernelAdapter';
export { DifyAdapter } from './adapters/DifyAdapter';
export { FlowiseAdapter } from './adapters/FlowiseAdapter';
export { OpenAIAgentsSDKAdapter } from './adapters/OpenAIAgentsSDKAdapter';
export { AzureAIFoundryAdapter } from './adapters/AzureAIFoundryAdapter';
export { AWSBedrockAdapter } from './adapters/AWSBedrockAdapter';
export { AgnoAdapter } from './adapters/AgnoAdapter';
export { HermesAdapter } from './adapters/HermesAdapter';
export { OpenClawAdapter } from './adapters/OpenClawAdapter';
export { AnthropicSDKAdapter } from './adapters/AnthropicSDKAdapter';
export type {
  AnthropicSDKClientLike, AnthropicMessagesLike, AnthropicMessageLike,
  AnthropicContentBlockLike, GovernedAnthropicClient
} from './adapters/AnthropicSDKAdapter';
export { LlamaIndexAdapter } from './adapters/LlamaIndexAdapter';
export type {
  LlamaIndexEngineLike, LlamaIndexNodeLike, GovernedLlamaIndexEngine
} from './adapters/LlamaIndexAdapter';
// Vertical adapters
export { RPAAdapter } from './adapters/RPAAdapter';
export { AlgoTradingAdapter, createAlgoTradingAdapter } from './adapters/AlgoTradingAdapter';
export { MedicalDeviceAdapter } from './adapters/MedicalDeviceAdapter';
export { AVFleetAdapter } from './adapters/AVFleetAdapter';
export { IndustrialIoTAdapter } from './adapters/IndustrialIoTAdapter';
export { CloudInfrastructureAdapter } from './adapters/CloudInfrastructureAdapter';

// Phase 1.5 IPI defense capsules (re-exported to fix orphan; audit RC#6 P02-F03)
export { DataSourceAttestation } from './capsules/DataSourceAttestation';
export { IngestSourceAdjudicator } from './capsules/IngestSourceAdjudicator';
