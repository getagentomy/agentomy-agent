import { AgentomyConfig } from '../client';
import { BaseAdapter, GovernedAgent } from './base';

/** Medical device SaMD interface -- consumer provides the real type */
export interface MedicalDeviceLike {
  name?: string;
  deviceClass?: string;
  regulatoryContext?: string;
  infer?: (input: unknown, context?: unknown) => Promise<unknown>;
  predict?: (input: unknown, context?: unknown) => Promise<unknown>;
  halt?: (reason?: string) => Promise<void>;
  status?: () => Promise<{ running: boolean; algorithmVersion?: string }>;
}

/**
 * MedicalDeviceAdapter -- wraps medical device SaMD with Agentomy governance.
 * Does not import any clinical framework. The consumer provides their device.
 * Supports gate mode (pre-decision authorization) and observer mode (post-decision logging).
 */
export class MedicalDeviceAdapter extends BaseAdapter {
  private deviceClass: string;
  private regulatoryContext: string;

  constructor(config?: AgentomyConfig, deviceClass = 'II', regulatoryContext = 'fda') {
    super(config || {}, `samd_${deviceClass}_${regulatoryContext}_device`);
    this.deviceClass = deviceClass;
    this.regulatoryContext = regulatoryContext;
  }

  wrap(device: MedicalDeviceLike): GovernedAgent {
    const deviceName = device.name || `samd_${this.deviceClass}_device`;
    this.agentName = deviceName;

    return {
      run: async (input: unknown) => {
        const clinicalInput = input as {
          decisionType: string;
          patientContext?: unknown;
          algorithmVersion?: string;
          targetSystem?: string;
        };
        const scope = clinicalInput.algorithmVersion
          ? `decision:${clinicalInput.decisionType}|version:${clinicalInput.algorithmVersion}`
          : `decision:${clinicalInput.decisionType}`;

        return this.govern(`clinical_decision:${scope}`, async () => {
          const fn = device.infer || device.predict;
          if (!fn) {throw new Error('Device has no infer/predict method');}
          return fn.call(device, clinicalInput.decisionType, clinicalInput.patientContext);
        });
      },
      halt: async (reason?: string) => {
        if (device.halt) {
          await device.halt(reason);
        }
        return this.haltAgent(reason || 'clinical_safety_halt');
      }
    };
  }
}
