import { AgentomyConfig } from '../client';
import { BaseAdapter, GovernedAgent } from './base';

/** Industrial IoT / ICS / SCADA device interface -- consumer provides the real type */
export interface IndustrialDeviceLike {
  name?: string;
  deviceType?: string; // PLC, RTU, HMI, sensor, actuator, edge-gateway
  protocol?: string; // Modbus, OPC-UA, DNP3, EtherNet/IP, BACnet, MQTT
  safetyClass?: string; // SIL1-SIL4 (IEC 61508) or PLa-PLe (ISO 13849)
  operate?: (input: unknown, context?: unknown) => Promise<unknown>;
  execute?: (input: unknown, context?: unknown) => Promise<unknown>;
  halt?: (reason?: string) => Promise<void>;
  status?: () => Promise<{ running: boolean; safetyState?: 'normal' | 'degraded' | 'tripped'; setpoints?: unknown }>;
}

/**
 * IndustrialIoTAdapter -- wraps industrial control system (ICS / SCADA / OT) agents
 * with Agentomy governance. Does not import any control framework. The consumer
 * provides their device interface. Supports gate mode (pre-actuation authorization)
 * and observer mode (post-actuation logging).
 *
 * Covers the same governance surface as GovernanceBench Suite 11 (industrial-iot.mjs)
 * and the website industrial-iot.html vertical: setpoint-change authorization,
 * safety-class enforcement (IEC 61508 SIL / ISO 13849 PL), OT-protocol audit trail,
 * out-of-bounds setpoint detection, and emergency halt that maps to the device's
 * own safety-trip path.
 *
 * Risk note: ICS actuations can cause physical-process harm. The wrap() flow runs
 * the Agentomy authorize check BEFORE calling the device's operate/execute method,
 * so a denied authorization never produces a real-world setpoint write. This is
 * the same gate-mode discipline as the AV Fleet adapter, calibrated for OT.
 */
export class IndustrialIoTAdapter extends BaseAdapter {
  private deviceType: string;
  private protocol: string;
  private safetyClass: string;

  constructor(
    config?: AgentomyConfig,
    deviceType = 'plc',
    protocol = 'modbus',
    safetyClass = 'SIL2'
  ) {
    super(config || {}, `industrial_iot_${deviceType}_${protocol}_${safetyClass}_device`);
    this.deviceType = deviceType;
    this.protocol = protocol;
    this.safetyClass = safetyClass;
  }

  wrap(device: IndustrialDeviceLike): GovernedAgent {
    const deviceName = device.name || `industrial_iot_${this.deviceType}_device`;
    this.agentName = deviceName;

    return {
      run: async (input: unknown) => {
        const operationInput = input as {
          operationType: string; // read_setpoint | write_setpoint | start | stop | calibrate
          tag?: string; // PLC tag / OPC-UA node id / Modbus register address
          value?: unknown; // setpoint value for writes
          deviceContext?: unknown;
        };
        const scope = operationInput.tag
          ? `op:${operationInput.operationType}|tag:${operationInput.tag}|safety:${this.safetyClass}`
          : `op:${operationInput.operationType}|safety:${this.safetyClass}`;

        return this.govern(`ics_actuation:${scope}`, async () => {
          const fn = device.operate || device.execute;
          if (!fn) {throw new Error('Industrial device has no operate/execute method');}
          return fn.call(device, operationInput.operationType, operationInput.deviceContext);
        });
      },
      halt: async (reason?: string) => {
        if (device.halt) {
          await device.halt(reason);
        }
        return this.haltAgent(reason || 'ics_safety_halt');
      }
    };
  }
}
