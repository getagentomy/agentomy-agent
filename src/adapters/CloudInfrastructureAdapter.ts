import { AgentomyConfig } from '../client';
import { BaseAdapter, GovernedAgent } from './base';

/** Cloud-resource / cloud-agent interface -- consumer provides the real type */
export interface CloudAgentLike {
  name?: string;
  cloudProvider?: string; // aws | azure | gcp | oci | hybrid
  resourceScope?: string; // arn / resourceId / project / subscription
  accountTier?: string; // dev | staging | prod | regulated
  operate?: (input: unknown, context?: unknown) => Promise<unknown>;
  execute?: (input: unknown, context?: unknown) => Promise<unknown>;
  halt?: (reason?: string) => Promise<void>;
  status?: () => Promise<{ running: boolean; resourcesTouched?: number; estimatedCostUSD?: number }>;
}

/**
 * CloudInfrastructureAdapter -- wraps cloud-management agents (the ones that
 * provision / scale / delete / migrate cloud resources) with Agentomy governance.
 * Does not import any cloud SDK. The consumer provides their cloud-action interface.
 * Supports gate mode (pre-action authorization, with cost + blast-radius bounds)
 * and observer mode (post-action logging).
 *
 * Covers the same governance surface as GovernanceBench Suite 13 (cloud-infrastructure.mjs)
 * and the website cloud-infrastructure.html vertical: cloud-agent authorization,
 * cloud-action audit trail (with provider/region/scope retained), fleet halt across
 * cloud accounts, and behavioral monitoring keyed to over-permissioned credentials
 * and bucket-scope drift (the 38TB-exposure pattern Wiz disclosed).
 *
 * Risk note: cloud actuations have real-money + real-exposure consequences. The
 * wrap() flow runs the Agentomy authorize check BEFORE calling the agent's
 * operate/execute method, so a denied authorization never produces a real
 * provisioning / deletion / IAM mutation. This is the same gate-mode discipline
 * as the Industrial IoT and AV Fleet adapters, calibrated for cloud.
 */
export class CloudInfrastructureAdapter extends BaseAdapter {
  private cloudProvider: string;
  private resourceScope: string;
  private accountTier: string;

  constructor(
    config?: AgentomyConfig,
    cloudProvider = 'aws',
    resourceScope = 'project',
    accountTier = 'staging'
  ) {
    super(config || {}, `cloud_infra_${cloudProvider}_${accountTier}_agent`);
    this.cloudProvider = cloudProvider;
    this.resourceScope = resourceScope;
    this.accountTier = accountTier;
  }

  wrap(agent: CloudAgentLike): GovernedAgent {
    const agentName = agent.name || `cloud_infra_${this.cloudProvider}_agent`;
    this.agentName = agentName;

    return {
      run: async (input: unknown) => {
        const operationInput = input as {
          operationType: string; // provision | scale | delete | iam_grant | bucket_policy | migrate
          resourceArn?: string;
          parameters?: unknown;
          estimatedCostUSD?: number;
          agentContext?: unknown;
        };
        const costScope = operationInput.estimatedCostUSD !== undefined
          ? `|cost:$${operationInput.estimatedCostUSD}`
          : '';
        const scope = operationInput.resourceArn
          ? `op:${operationInput.operationType}|arn:${operationInput.resourceArn}|tier:${this.accountTier}${costScope}`
          : `op:${operationInput.operationType}|tier:${this.accountTier}${costScope}`;

        return this.govern(`cloud_action:${scope}`, async () => {
          const fn = agent.operate || agent.execute;
          if (!fn) {throw new Error('Cloud agent has no operate/execute method');}
          return fn.call(agent, operationInput.operationType, operationInput.agentContext);
        });
      },
      halt: async (reason?: string) => {
        if (agent.halt) {
          await agent.halt(reason);
        }
        return this.haltAgent(reason || 'cloud_safety_halt');
      }
    };
  }
}
