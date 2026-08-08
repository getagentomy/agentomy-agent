import { AgentomyConfig } from '../client';
import { BaseAdapter, GovernedAgent } from './base';

/** Autonomous vehicle fleet interface -- consumer provides the real type */
export interface AVFleetVehicleLike {
  name?: string;
  autonomyLevel?: number;
  regulatoryContext?: string;
  operate?: (input: unknown, context?: unknown) => Promise<unknown>;
  execute?: (input: unknown, context?: unknown) => Promise<unknown>;
  halt?: (reason?: string) => Promise<void>;
  status?: () => Promise<{ running: boolean; oddCompliant?: boolean; position?: unknown }>;
}

/**
 * AVFleetAdapter -- wraps autonomous vehicle fleet systems with Agentomy governance.
 * Does not import any vehicle framework. The consumer provides their vehicle interface.
 * Supports gate mode (pre-operation authorization) and observer mode (post-operation logging).
 */
export class AVFleetAdapter extends BaseAdapter {
  private autonomyLevel: number;
  private regulatoryContext: string;

  constructor(config?: AgentomyConfig, autonomyLevel = 4, regulatoryContext = 'nhtsa') {
    super(config || {}, `av_fleet_L${autonomyLevel}_${regulatoryContext}_vehicle`);
    this.autonomyLevel = autonomyLevel;
    this.regulatoryContext = regulatoryContext;
  }

  wrap(vehicle: AVFleetVehicleLike): GovernedAgent {
    const vehicleName = vehicle.name || `av_fleet_L${this.autonomyLevel}_vehicle`;
    this.agentName = vehicleName;

    return {
      run: async (input: unknown) => {
        const operationInput = input as {
          operationType: string;
          vehicleContext?: unknown;
          oddParameters?: unknown;
          targetSystem?: string;
        };
        const scope = operationInput.oddParameters
          ? `operation:${operationInput.operationType}|odd:${JSON.stringify(operationInput.oddParameters).slice(0, 200)}`
          : `operation:${operationInput.operationType}`;

        return this.govern(`autonomous_operation:${scope}`, async () => {
          const fn = vehicle.operate || vehicle.execute;
          if (!fn) {throw new Error('Vehicle has no operate/execute method');}
          return fn.call(vehicle, operationInput.operationType, operationInput.vehicleContext);
        });
      },
      halt: async (reason?: string) => {
        if (vehicle.halt) {
          await vehicle.halt(reason);
        }
        return this.haltAgent(reason || 'fleet_safety_halt');
      }
    };
  }
}
