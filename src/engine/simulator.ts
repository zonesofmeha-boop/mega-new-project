import {
  EndpointId,
  TcpState,
  TCB,
  TcpPacket,
  TcpSnapshot,
  LogEntry,
  SimulationStats,
  FailureConfig,
  FailureType,
  ALL_TCP_STATES,
} from './types';
import { transition } from './fsm';
import {
  createSynPacket,
  createSynAckPacket,
  createAckPacket,
  createDataPacket,
  createFinPacket,
  createRstPacket,
  segmentMessage,
  seqLessThanOrEqual,
  seqGreaterThan,
} from './packet';
import { SeededPRNG } from './prng';
import { getFailureConfig } from './failures';

export interface SimEvent {
  id: string;
  tick: number;
  type:
    | 'PACKET_DELIVERY'
    | 'RETRANSMIT_TIMER'
    | 'TIME_WAIT_TIMER'
    | 'APP_COMMAND';
  endpoint: EndpointId;
  packet?: TcpPacket;
  command?: 'OPEN' | 'SEND' | 'CLOSE' | 'ABORT';
  payload?: any;
  description: string;
}

export interface SimulatorOptions {
  seed?: number;
  clientMss?: number;
  serverMss?: number;
  defaultLatency?: number; // virtual ms per one-way trip
  serverStartsInListen?: boolean;
}

const DEFAULT_LATENCY = 50; // ms
const INITIAL_RTO = 200; // ms
const TIME_WAIT_DURATION = 120; // virtual ms
const MAX_RETRANSMITS = 4;

export class TcpSimulator {
  private prng: SeededPRNG;
  private virtualTime: number = 0;
  private eventQueue: SimEvent[] = [];
  private eventCounter: number = 0;
  private history: TcpSnapshot[] = [];
  private currentCursor: number = 0;

  private client: TCB;
  private server: TCB;
  private inFlightPackets: TcpPacket[] = [];
  private packetHistory: TcpPacket[] = [];
  private logs: LogEntry[] = [];
  private activeFailures: Map<FailureType, FailureConfig> = new Map();

  private stats: SimulationStats = {
    totalPacketsSent: 0,
    packetsDelivered: 0,
    packetsDropped: 0,
    packetsCorrupted: 0,
    retransmissions: 0,
    dupAcks: 0,
    bytesTransferred: 0,
    averageRtt: 100,
    currentRtt: 100,
    rttHistory: [],
    packetTypeCounts: {
      SYN: 0,
      SYN_ACK: 0,
      ACK: 0,
      DATA: 0,
      FIN: 0,
      FIN_ACK: 0,
      RST: 0,
      DUP_ACK: 0,
    },
  };

  private lastEventDesc: string = 'Simulator initialized.';
  private lastTransition?: {
    endpoint: EndpointId;
    fromState: TcpState;
    toState: TcpState;
    event: any;
    edgeId: string;
  };

  private options: Required<SimulatorOptions>;

  constructor(options: SimulatorOptions = {}) {
    this.options = {
      seed: options.seed ?? 1337,
      clientMss: options.clientMss ?? 16,
      serverMss: options.serverMss ?? 16,
      defaultLatency: options.defaultLatency ?? DEFAULT_LATENCY,
      serverStartsInListen: options.serverStartsInListen ?? true,
    };

    this.prng = new SeededPRNG(this.options.seed);

    // Initial sequence numbers
    const clientIss = this.prng.nextInt(1000, 9999);
    const serverIss = this.prng.nextInt(50000, 59999);

    this.client = {
      endpoint: 'client',
      ip: '192.168.1.101',
      port: 52140,
      state: 'CLOSED',
      sndUna: clientIss,
      sndNxt: clientIss,
      sndWnd: 65535,
      sndUp: 0,
      sndWl1: 0,
      sndWl2: 0,
      iss: clientIss,
      rcvNxt: 0,
      rcvWnd: 65535,
      rcvUp: 0,
      irs: 0,
      rto: INITIAL_RTO,
      srtt: 100,
      rttvar: 50,
      timerRetransmit: null,
      timerTimeWait: null,
      retransmitCount: 0,
      maxRetransmits: MAX_RETRANSMITS,
      sendQueue: [],
      receiveQueue: [],
      deliveredData: '',
      dupAckCount: 0,
      fastRetransmitTriggered: false,
      mss: this.options.clientMss,
    };

    this.server = {
      endpoint: 'server',
      ip: '192.168.1.10',
      port: 80,
      state: this.options.serverStartsInListen ? 'LISTEN' : 'CLOSED',
      sndUna: serverIss,
      sndNxt: serverIss,
      sndWnd: 65535,
      sndUp: 0,
      sndWl1: 0,
      sndWl2: 0,
      iss: serverIss,
      rcvNxt: 0,
      rcvWnd: 65535,
      rcvUp: 0,
      irs: 0,
      rto: INITIAL_RTO,
      srtt: 100,
      rttvar: 50,
      timerRetransmit: null,
      timerTimeWait: null,
      retransmitCount: 0,
      maxRetransmits: MAX_RETRANSMITS,
      sendQueue: [],
      receiveQueue: [],
      deliveredData: '',
      dupAckCount: 0,
      fastRetransmitTriggered: false,
      mss: this.options.serverMss,
    };

    this.log(
      'info',
      'app',
      `Engine initialized. Server on :80 (${this.server.state}), Client on :52140 (CLOSED).`,
      undefined,
      'network'
    );

    // Record initial snapshot at step 0
    this.recordSnapshot();
  }

  // ==========================================
  // Public API
  // ==========================================

  public getSnapshot(): TcpSnapshot {
    if (this.currentCursor >= 0 && this.currentCursor < this.history.length) {
      return this.history[this.currentCursor];
    }
    return this.history[this.history.length - 1];
  }

  public getHistory(): readonly TcpSnapshot[] {
    return this.history;
  }

  public getCursor(): number {
    return this.currentCursor;
  }

  public getHistoryLength(): number {
    return this.history.length;
  }

  public seek(stepIndex: number): TcpSnapshot {
    if (stepIndex < 0) stepIndex = 0;
    if (stepIndex >= this.history.length) stepIndex = this.history.length - 1;
    this.currentCursor = stepIndex;
    return this.history[stepIndex];
  }

  public canStep(): boolean {
    return this.currentCursor < this.history.length - 1 || this.eventQueue.length > 0;
  }

  public canStepBack(): boolean {
    return this.currentCursor > 0;
  }

  /**
   * Advances the simulation by exactly one discrete event.
   * If cursor is in the past, moves cursor forward to existing snapshot.
   * Otherwise processes next event from the event queue and creates a new immutable snapshot.
   */
  public step(): TcpSnapshot {
    if (this.currentCursor < this.history.length - 1) {
      this.currentCursor++;
      return this.history[this.currentCursor];
    }

    if (this.eventQueue.length === 0) {
      // Nothing to process, return latest
      return this.history[this.history.length - 1];
    }

    // Sort queue by virtual tick ascending, then event counter
    this.eventQueue.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      return a.id.localeCompare(b.id);
    });

    const event = this.eventQueue.shift()!;
    this.virtualTime = event.tick;
    this.lastEventDesc = event.description;

    this.processEvent(event);
    this.recordSnapshot();
    this.currentCursor = this.history.length - 1;

    return this.history[this.currentCursor];
  }

  /**
   * User command: Initiates Active Open (3-way handshake) from Client
   */
  public clientOpen(): void {
    this.enqueueAppCommand('client', 'OPEN', 'Client application requests active connection');
  }

  /**
   * User command: Server passive open
   */
  public serverListen(): void {
    this.enqueueAppCommand('server', 'OPEN', 'Server application opens port for listening');
  }

  /**
   * User command: Send data message from an endpoint
   */
  public sendData(message: string, endpoint: EndpointId = 'client'): void {
    this.enqueueAppCommand(
      endpoint,
      'SEND',
      `${endpoint.toUpperCase()} requests sending ${message.length} bytes: "${message}"`,
      { message }
    );
  }

  /**
   * User command: Graceful connection teardown (send FIN)
   */
  public closeConnection(endpoint: EndpointId = 'client'): void {
    this.enqueueAppCommand(
      endpoint,
      'CLOSE',
      `${endpoint.toUpperCase()} application requests graceful close`
    );
  }

  /**
   * User command: Abrupt reset (send RST)
   */
  public abortConnection(endpoint: EndpointId = 'client'): void {
    this.enqueueAppCommand(
      endpoint,
      'ABORT',
      `${endpoint.toUpperCase()} application requests connection abort (RST)`
    );
  }

  /**
   * Set or toggle failure injection
   */
  public setFailure(type: FailureType, active: boolean, customConfig?: Partial<FailureConfig>): void {
    if (!active || type === 'none') {
      this.activeFailures.delete(type);
      return;
    }
    const base = getFailureConfig(type);
    const config: FailureConfig = {
      ...base,
      ...customConfig,
      isActive: true,
      remainingUses: customConfig?.remainingUses ?? base.remainingUses ?? 1,
    };
    this.activeFailures.set(type, config);
    this.log(
      'warn',
      'failure',
      `Injected failure rule: ${config.title}. (${config.explanation})`,
      undefined,
      'network'
    );
    this.recordSnapshot();
    this.currentCursor = this.history.length - 1;
  }

  public clearAllFailures(): void {
    this.activeFailures.clear();
    this.recordSnapshot();
    this.currentCursor = this.history.length - 1;
  }

  // ==========================================
  // Private Event Processing
  // ==========================================

  private enqueueAppCommand(
    endpoint: EndpointId,
    command: 'OPEN' | 'SEND' | 'CLOSE' | 'ABORT',
    description: string,
    payload?: any
  ): void {
    this.eventCounter++;
    const simEvent: SimEvent = {
      id: `EVT-${this.eventCounter.toString().padStart(4, '0')}`,
      tick: this.virtualTime,
      type: 'APP_COMMAND',
      endpoint,
      command,
      payload,
      description,
    };
    this.eventQueue.push(simEvent);
  }

  private enqueuePacketDelivery(packet: TcpPacket, delay: number = this.options.defaultLatency): void {
    this.eventCounter++;
    packet.sentAtTime = this.virtualTime;
    packet.deliverAtTime = this.virtualTime + delay;

    this.inFlightPackets.push(packet);
    this.packetHistory.push(packet);
    this.stats.totalPacketsSent++;
    this.stats.packetTypeCounts[packet.type] = (this.stats.packetTypeCounts[packet.type] || 0) + 1;

    const simEvent: SimEvent = {
      id: `EVT-${this.eventCounter.toString().padStart(4, '0')}`,
      tick: packet.deliverAtTime,
      type: 'PACKET_DELIVERY',
      endpoint: packet.destination,
      packet,
      description: `Transmit ${packet.type} [SEQ=${packet.seqNum}, ACK=${packet.ackNum}, LEN=${packet.length}] to ${packet.destination.toUpperCase()}`,
    };

    this.eventQueue.push(simEvent);
  }

  private cancelRetransmitTimer(endpointId: EndpointId): void {
    const tcb = endpointId === 'client' ? this.client : this.server;
    tcb.timerRetransmit = null;
    this.eventQueue = this.eventQueue.filter(
      (e) => !(e.type === 'RETRANSMIT_TIMER' && e.endpoint === endpointId)
    );
  }

  private cancelTimeWaitTimer(endpointId: EndpointId): void {
    const tcb = endpointId === 'client' ? this.client : this.server;
    tcb.timerTimeWait = null;
    this.eventQueue = this.eventQueue.filter(
      (e) => !(e.type === 'TIME_WAIT_TIMER' && e.endpoint === endpointId)
    );
  }

  private scheduleRetransmitTimer(endpointId: EndpointId): void {
    this.cancelRetransmitTimer(endpointId);
    const tcb = endpointId === 'client' ? this.client : this.server;
    const expiry = this.virtualTime + tcb.rto;
    tcb.timerRetransmit = expiry;

    this.eventCounter++;
    const simEvent: SimEvent = {
      id: `EVT-${this.eventCounter.toString().padStart(4, '0')}`,
      tick: expiry,
      type: 'RETRANSMIT_TIMER',
      endpoint: endpointId,
      description: `${endpointId.toUpperCase()} RTO Timer (${tcb.rto}ms) scheduled for tick ${expiry}`,
    };

    this.eventQueue.push(simEvent);
  }

  private scheduleTimeWaitTimer(endpointId: EndpointId): void {
    const tcb = endpointId === 'client' ? this.client : this.server;
    const expiry = this.virtualTime + TIME_WAIT_DURATION;
    tcb.timerTimeWait = expiry;

    this.eventCounter++;
    const simEvent: SimEvent = {
      id: `EVT-${this.eventCounter.toString().padStart(4, '0')}`,
      tick: expiry,
      type: 'TIME_WAIT_TIMER',
      endpoint: endpointId,
      description: `${endpointId.toUpperCase()} 2MSL TIME_WAIT Timer (${TIME_WAIT_DURATION}ms) expires at tick ${expiry}`,
    };

    this.eventQueue.push(simEvent);
  }

  private processEvent(event: SimEvent): void {
    switch (event.type) {
      case 'APP_COMMAND':
        this.processAppCommand(event);
        break;
      case 'PACKET_DELIVERY':
        if (event.packet) {
          this.processPacketDelivery(event.packet);
        }
        break;
      case 'RETRANSMIT_TIMER':
        this.processRetransmitTimeout(event.endpoint);
        break;
      case 'TIME_WAIT_TIMER':
        this.processTimeWaitTimeout(event.endpoint);
        break;
    }
  }

  private processAppCommand(event: SimEvent): void {
    const ep = event.endpoint;
    const tcb = ep === 'client' ? this.client : this.server;

    if (event.command === 'OPEN') {
      if (ep === 'client') {
        const res = transition(tcb.state, 'APP_OPEN_ACTIVE');
        if (res.isValid) {
          this.recordTransition(ep, tcb.state, res.nextState, 'APP_OPEN_ACTIVE', res.rule?.id || '');
          tcb.state = res.nextState;
          this.log('info', 'fsm', res.logMessage, undefined, ep);

          // Client creates SYN
          const synPkt = createSynPacket(
            'client',
            'server',
            tcb.sndNxt,
            tcb.port,
            this.server.port,
            tcb.rcvWnd
          );
          tcb.sndNxt = (tcb.sndNxt + 1) >>> 0; // SYN consumes 1 sequence number
          this.enqueuePacketDelivery(synPkt);
          this.scheduleRetransmitTimer('client');
        } else {
          this.log('warn', 'fsm', res.logMessage, undefined, ep);
        }
      } else {
        const res = transition(tcb.state, 'APP_OPEN_PASSIVE');
        if (res.isValid) {
          this.recordTransition(ep, tcb.state, res.nextState, 'APP_OPEN_PASSIVE', res.rule?.id || '');
          tcb.state = res.nextState;
          this.log('info', 'fsm', res.logMessage, undefined, ep);
        }
      }
    } else if (event.command === 'SEND') {
      if (tcb.state !== 'ESTABLISHED') {
        this.log('error', 'app', `Cannot send data in state ${tcb.state}. Connection not established.`, undefined, ep);
        return;
      }
      const message: string = event.payload?.message || 'Hello TCP';
      const segments = segmentMessage(message, tcb.mss, tcb.sndNxt);

      this.log('info', 'buffer', `Segmented ${message.length} bytes into ${segments.length} segments (MSS=${tcb.mss})`, undefined, ep);

      for (const seg of segments) {
        tcb.sendQueue.push(seg);
        const dataPkt = createDataPacket(
          ep,
          ep === 'client' ? 'server' : 'client',
          seg.seq,
          tcb.rcvNxt,
          seg.data,
          tcb.port,
          ep === 'client' ? this.server.port : this.client.port
        );
        tcb.sndNxt = (tcb.sndNxt + seg.length) >>> 0;
        this.enqueuePacketDelivery(dataPkt);
      }

      this.scheduleRetransmitTimer(ep);
    } else if (event.command === 'CLOSE') {
      const res = transition(tcb.state, 'APP_CLOSE');
      if (res.isValid) {
        this.recordTransition(ep, tcb.state, res.nextState, 'APP_CLOSE', res.rule?.id || '');
        tcb.state = res.nextState;
        this.log('info', 'fsm', res.logMessage, undefined, ep);

        if (res.nextState === 'FIN_WAIT_1' || res.nextState === 'LAST_ACK') {
          const finPkt = createFinPacket(
            ep,
            ep === 'client' ? 'server' : 'client',
            tcb.sndNxt,
            tcb.rcvNxt,
            tcb.port,
            ep === 'client' ? this.server.port : this.client.port,
            tcb.rcvWnd
          );
          tcb.sndNxt = (tcb.sndNxt + 1) >>> 0; // FIN consumes 1 sequence number
          this.enqueuePacketDelivery(finPkt);
          this.scheduleRetransmitTimer(ep);
        }
      } else {
        this.log('warn', 'fsm', res.logMessage, undefined, ep);
      }
    } else if (event.command === 'ABORT') {
      const res = transition(tcb.state, 'APP_ABORT');
      if (res.isValid) {
        this.recordTransition(ep, tcb.state, res.nextState, 'APP_ABORT', res.rule?.id || '');
        tcb.state = res.nextState;
        this.cancelRetransmitTimer(ep);
        this.cancelTimeWaitTimer(ep);
        this.log('warn', 'fsm', res.logMessage, undefined, ep);

        const rstPkt = createRstPacket(
          ep,
          ep === 'client' ? 'server' : 'client',
          tcb.sndNxt,
          tcb.rcvNxt,
          tcb.port,
          ep === 'client' ? this.server.port : this.client.port
        );
        this.enqueuePacketDelivery(rstPkt);
      }
    }
  }

  private processPacketDelivery(packet: TcpPacket): void {
    // Remove from in-flight
    this.inFlightPackets = this.inFlightPackets.filter((p) => p.id !== packet.id);

    // Apply active network failure rules
    const failureOutcome = this.evaluateFailures(packet);
    if (failureOutcome === 'DROP') {
      packet.status = 'dropped';
      packet.isDropped = true;
      packet.dropReason = 'Simulated packet loss in network channel';
      this.stats.packetsDropped++;
      this.log('error', 'failure', `Packet ${packet.id} (${packet.type}) dropped by simulated packet loss.`, undefined, 'network');
      return;
    }

    if (failureOutcome === 'CORRUPT') {
      packet.status = 'corrupted';
      packet.isCorrupted = true;
      packet.checksum = 0xdead; // corrupted checksum
      this.stats.packetsCorrupted++;
      this.log('error', 'failure', `Packet ${packet.id} (${packet.type}) checksum corrupted in transit (0xDEAD). Receiver will silently discard.`, undefined, 'network');
      return;
    }

    packet.status = 'delivered';
    this.stats.packetsDelivered++;

    // Calculate RTT sample if ACK covers outstanding data
    const rttSample = Math.max(10, this.virtualTime - packet.sentAtTime);
    this.stats.currentRtt = rttSample;
    this.stats.averageRtt = Math.round(this.stats.averageRtt * 0.875 + rttSample * 0.125);
    this.stats.rttHistory.push({ step: this.virtualTime, rtt: rttSample });

    const receiver = packet.destination === 'client' ? this.client : this.server;

    // Check for Port Closed (SYN to closed server)
    if (packet.flags.syn && receiver.state === 'CLOSED') {
      this.log('warn', 'fsm', `Destination port ${receiver.port} is CLOSED. Responding with RST.`, undefined, receiver.endpoint);
      const rstPkt = createRstPacket(
        receiver.endpoint,
        packet.source,
        0,
        (packet.seqNum + 1) >>> 0,
        receiver.port,
        packet.srcPort
      );
      this.enqueuePacketDelivery(rstPkt);
      return;
    }

    // Process RST flag
    if (packet.flags.rst) {
      this.handleRstPacket(receiver, packet);
      return;
    }

    // Process SYN in LISTEN state
    if (packet.flags.syn && !packet.flags.ack && receiver.state === 'LISTEN') {
      this.handleSynInListen(receiver, packet);
      return;
    }

    // Process SYN+ACK in SYN_SENT state
    if (packet.flags.syn && packet.flags.ack && receiver.state === 'SYN_SENT') {
      this.handleSynAckInSynSent(receiver, packet);
      return;
    }

    // Process Simultaneous Open: SYN in SYN_SENT
    if (packet.flags.syn && !packet.flags.ack && receiver.state === 'SYN_SENT') {
      this.handleSimultaneousOpen(receiver, packet);
      return;
    }

    // Process pure ACK during handshake completion (SYN_RECEIVED -> ESTABLISHED)
    if (packet.flags.ack && !packet.flags.syn && !packet.flags.fin && receiver.state === 'SYN_RECEIVED') {
      this.handleAckInSynReceived(receiver, packet);
      return;
    }

    // Process DATA segment
    if (packet.type === 'DATA' || (packet.payload && packet.payload.length > 0)) {
      this.handleDataSegment(receiver, packet);
      return;
    }

    // Process pure ACK (e.g. data acknowledgment or dup ACK)
    if (packet.flags.ack && !packet.flags.fin && !packet.flags.syn) {
      this.handleAckSegment(receiver, packet);
    }

    // Process FIN segment
    if (packet.flags.fin) {
      this.handleFinSegment(receiver, packet);
    }
  }

  private handleRstPacket(receiver: TCB, packet: TcpPacket): void {
    const res = transition(receiver.state, 'RCV_RST');
    this.recordTransition(receiver.endpoint, receiver.state, res.nextState, 'RCV_RST', res.rule?.id || '');
    receiver.state = res.nextState;
    this.cancelRetransmitTimer(receiver.endpoint);
    this.cancelTimeWaitTimer(receiver.endpoint);
    this.log('error', 'fsm', `Received RST [SEQ=${packet.seqNum}]. Connection reset: ${res.logMessage}`, undefined, receiver.endpoint);
  }

  private handleSynInListen(receiver: TCB, packet: TcpPacket): void {
    receiver.irs = packet.seqNum;
    receiver.rcvNxt = (packet.seqNum + 1) >>> 0;

    const res = transition(receiver.state, 'RCV_SYN');
    if (res.isValid) {
      this.recordTransition(receiver.endpoint, receiver.state, res.nextState, 'RCV_SYN', res.rule?.id || '');
      receiver.state = res.nextState;
      this.log('info', 'fsm', `${res.logMessage}. IRS recorded as ${receiver.irs}`, undefined, receiver.endpoint);

      const synAck = createSynAckPacket(
        receiver.endpoint,
        packet.source,
        receiver.sndNxt,
        receiver.rcvNxt,
        receiver.port,
        packet.srcPort,
        receiver.rcvWnd
      );
      receiver.sndNxt = (receiver.sndNxt + 1) >>> 0;
      this.enqueuePacketDelivery(synAck);
      this.scheduleRetransmitTimer(receiver.endpoint);
    }
  }

  private handleSynAckInSynSent(receiver: TCB, packet: TcpPacket): void {
    // Validate acknowledgment
    if (packet.ackNum === receiver.sndNxt) {
      receiver.irs = packet.seqNum;
      receiver.rcvNxt = (packet.seqNum + 1) >>> 0;
      receiver.sndUna = packet.ackNum;
      this.cancelRetransmitTimer(receiver.endpoint); // SYN ACKed!

      const res = transition(receiver.state, 'RCV_SYN_ACK');
      if (res.isValid) {
        this.recordTransition(receiver.endpoint, receiver.state, res.nextState, 'RCV_SYN_ACK', res.rule?.id || '');
        receiver.state = res.nextState;
        this.log('success', 'fsm', `${res.logMessage}. Connection successfully ESTABLISHED!`, undefined, receiver.endpoint);

        // Send final ACK of 3-way handshake
        const ackPkt = createAckPacket(
          receiver.endpoint,
          packet.source,
          receiver.sndNxt,
          receiver.rcvNxt,
          receiver.port,
          packet.srcPort,
          false,
          receiver.rcvWnd
        );
        this.enqueuePacketDelivery(ackPkt);
      }
    } else {
      this.log('warn', 'packet', `Invalid ACK in SYN_ACK: expected ${receiver.sndNxt}, got ${packet.ackNum}`, undefined, receiver.endpoint);
    }
  }

  private handleSimultaneousOpen(receiver: TCB, packet: TcpPacket): void {
    receiver.irs = packet.seqNum;
    receiver.rcvNxt = (packet.seqNum + 1) >>> 0;

    const res = transition(receiver.state, 'RCV_SYN');
    if (res.isValid) {
      this.recordTransition(receiver.endpoint, receiver.state, res.nextState, 'RCV_SYN', res.rule?.id || '');
      receiver.state = res.nextState;
      this.log('info', 'fsm', `Simultaneous open triggered! Sent SYN+ACK in response to peer SYN.`, undefined, receiver.endpoint);

      const synAck = createSynAckPacket(
        receiver.endpoint,
        packet.source,
        receiver.sndNxt,
        receiver.rcvNxt,
        receiver.port,
        packet.srcPort
      );
      receiver.sndNxt = (receiver.sndNxt + 1) >>> 0;
      this.enqueuePacketDelivery(synAck);
    }
  }

  private handleAckInSynReceived(receiver: TCB, packet: TcpPacket): void {
    if (packet.ackNum === receiver.sndNxt) {
      receiver.sndUna = packet.ackNum;
      this.cancelRetransmitTimer(receiver.endpoint); // Cancel SYN-ACK retransmit

      const res = transition(receiver.state, 'RCV_ACK');
      if (res.isValid) {
        this.recordTransition(receiver.endpoint, receiver.state, res.nextState, 'RCV_ACK', res.rule?.id || '');
        receiver.state = res.nextState;
        this.log('success', 'fsm', `${res.logMessage}. Server connection is ESTABLISHED!`, undefined, receiver.endpoint);
      }
    }
  }

  private handleDataSegment(receiver: TCB, packet: TcpPacket): void {
    const seq = packet.seqNum;
    const len = packet.length;

    // Check for duplicate already-acknowledged data
    if (seqLessThanOrEqual((seq + len) >>> 0, receiver.rcvNxt)) {
      this.log('warn', 'buffer', `Discarding duplicate segment [SEQ=${seq}, LEN=${len} <= RCV.NXT=${receiver.rcvNxt}].`, undefined, receiver.endpoint);
      // Send immediate ACK with current RCV.NXT
      const ackPkt = createAckPacket(
        receiver.endpoint,
        packet.source,
        receiver.sndNxt,
        receiver.rcvNxt,
        receiver.port,
        packet.srcPort,
        true,
        receiver.rcvWnd
      );
      this.enqueuePacketDelivery(ackPkt);
      return;
    }

    if (seq === receiver.rcvNxt) {
      // In-order segment!
      receiver.deliveredData += packet.payload;
      receiver.rcvNxt = (receiver.rcvNxt + len) >>> 0;
      this.stats.bytesTransferred += len;

      this.log('success', 'buffer', `Accepted in-order segment [SEQ=${seq}, LEN=${len}]. Total received: ${receiver.deliveredData.length}B`, undefined, receiver.endpoint);

      // Check reassembly queue to see if we plugged holes!
      receiver.receiveQueue.sort((a, b) => a.seq - b.seq);
      while (receiver.receiveQueue.length > 0 && receiver.receiveQueue[0].seq === receiver.rcvNxt) {
        const buffered = receiver.receiveQueue.shift()!;
        receiver.deliveredData += buffered.data;
        receiver.rcvNxt = (receiver.rcvNxt + buffered.length) >>> 0;
        this.stats.bytesTransferred += buffered.length;
        this.log('success', 'buffer', `Reassembled buffered segment [SEQ=${buffered.seq}, LEN=${buffered.length}]! New RCV.NXT=${receiver.rcvNxt}`, undefined, receiver.endpoint);
      }

      // Send cumulative ACK
      const ackPkt = createAckPacket(
        receiver.endpoint,
        packet.source,
        receiver.sndNxt,
        receiver.rcvNxt,
        receiver.port,
        packet.srcPort,
        false,
        receiver.rcvWnd
      );
      this.enqueuePacketDelivery(ackPkt);
    } else if (seqGreaterThan(seq, receiver.rcvNxt)) {
      // Out-of-order segment! Buffer it and send Duplicate ACK for RCV.NXT
      const existing = receiver.receiveQueue.find((s) => s.seq === seq);
      if (!existing) {
        receiver.receiveQueue.push({
          seq,
          data: packet.payload,
          length: len,
          retries: 0,
        });
      }

      this.log('warn', 'buffer', `Out-of-order segment [SEQ=${seq} > expected RCV.NXT=${receiver.rcvNxt}]. Buffered in reassembly queue. Sending Dup ACK=${receiver.rcvNxt}.`, undefined, receiver.endpoint);

      const dupAckPkt = createAckPacket(
        receiver.endpoint,
        packet.source,
        receiver.sndNxt,
        receiver.rcvNxt,
        receiver.port,
        packet.srcPort,
        true,
        receiver.rcvWnd
      );
      this.enqueuePacketDelivery(dupAckPkt);
    }
  }

  private handleAckSegment(receiver: TCB, packet: TcpPacket): void {
    const ack = packet.ackNum;

    // Is this ACK advancing sndUna?
    if (seqGreaterThan(ack, receiver.sndUna) && seqLessThanOrEqual(ack, receiver.sndNxt)) {
      const ackedBytes = (ack - receiver.sndUna) | 0;
      receiver.sndUna = ack;
      receiver.dupAckCount = 0;
      receiver.fastRetransmitTriggered = false;
      receiver.retransmitCount = 0; // reset retry counter

      // Remove acknowledged segments from sendQueue
      receiver.sendQueue = receiver.sendQueue.filter(
        (seg) => (seg.seq + seg.length) > ack
      );

      this.log('info', 'packet', `Cumulative ACK received for ${ackedBytes} bytes. SND.UNA advanced to ${receiver.sndUna}.`, undefined, receiver.endpoint);

      if (receiver.sendQueue.length === 0) {
        this.cancelRetransmitTimer(receiver.endpoint); // All outstanding data acknowledged
      } else {
        // Reset RTO for remaining unacknowledged data
        this.scheduleRetransmitTimer(receiver.endpoint);
      }
    } else if (ack === receiver.sndUna) {
      // Duplicate ACK!
      receiver.dupAckCount++;
      this.stats.dupAcks++;
      this.log('warn', 'packet', `Duplicate ACK #${receiver.dupAckCount} for SND.UNA=${receiver.sndUna}`, undefined, receiver.endpoint);

      // Fast Retransmit on 3 duplicate ACKs (RFC 5681)
      if (receiver.dupAckCount === 3 && !receiver.fastRetransmitTriggered) {
        receiver.fastRetransmitTriggered = true;
        this.log('error', 'failure', `Fast Retransmit triggered by 3 Duplicate ACKs! Immediately resending lost segment [SEQ=${receiver.sndUna}] without waiting for RTO.`, undefined, receiver.endpoint);

        const lostSeg = receiver.sendQueue.find((s) => s.seq === receiver.sndUna);
        if (lostSeg) {
          lostSeg.retries++;
          this.stats.retransmissions++;
          const rtxPkt = createDataPacket(
            receiver.endpoint,
            packet.source,
            lostSeg.seq,
            receiver.rcvNxt,
            lostSeg.data,
            receiver.port,
            packet.srcPort,
            true
          );
          this.enqueuePacketDelivery(rtxPkt);
        }
      }
    }

    // Check teardown states that respond to ACKs
    if (receiver.state === 'FIN_WAIT_1') {
      const res = transition(receiver.state, 'RCV_ACK');
      if (res.isValid) {
        this.recordTransition(receiver.endpoint, receiver.state, res.nextState, 'RCV_ACK', res.rule?.id || '');
        receiver.state = res.nextState;
        this.log('info', 'fsm', res.logMessage, undefined, receiver.endpoint);
      }
    } else if (receiver.state === 'CLOSING') {
      const res = transition(receiver.state, 'RCV_ACK');
      if (res.isValid) {
        this.recordTransition(receiver.endpoint, receiver.state, res.nextState, 'RCV_ACK', res.rule?.id || '');
        receiver.state = res.nextState;
        this.log('info', 'fsm', res.logMessage, undefined, receiver.endpoint);
        this.scheduleTimeWaitTimer(receiver.endpoint);
      }
    } else if (receiver.state === 'LAST_ACK') {
      const res = transition(receiver.state, 'RCV_ACK');
      if (res.isValid) {
        this.recordTransition(receiver.endpoint, receiver.state, res.nextState, 'RCV_ACK', res.rule?.id || '');
        receiver.state = res.nextState;
        receiver.timerRetransmit = null;
        this.log('success', 'fsm', `Connection closed gracefully: ${res.logMessage}`, undefined, receiver.endpoint);
      }
    }
  }

  private handleFinSegment(receiver: TCB, packet: TcpPacket): void {
    receiver.rcvNxt = (packet.seqNum + 1) >>> 0; // FIN consumes 1 sequence number

    if (receiver.state === 'ESTABLISHED') {
      // Passive Close
      const res = transition(receiver.state, 'RCV_FIN');
      if (res.isValid) {
        this.recordTransition(receiver.endpoint, receiver.state, res.nextState, 'RCV_FIN', res.rule?.id || '');
        receiver.state = res.nextState;
        this.log('info', 'fsm', `${res.logMessage}. Peer initiated close.`, undefined, receiver.endpoint);

        // Send ACK for peer FIN
        const ackPkt = createAckPacket(
          receiver.endpoint,
          packet.source,
          receiver.sndNxt,
          receiver.rcvNxt,
          receiver.port,
          packet.srcPort
        );
        this.enqueuePacketDelivery(ackPkt);
      }
    } else if (receiver.state === 'FIN_WAIT_1') {
      // Simultaneous close: both sent FIN
      const res = transition(receiver.state, packet.flags.ack ? 'RCV_FIN_ACK' : 'RCV_FIN');
      if (res.isValid) {
        this.recordTransition(receiver.endpoint, receiver.state, res.nextState, packet.flags.ack ? 'RCV_FIN_ACK' : 'RCV_FIN', res.rule?.id || '');
        receiver.state = res.nextState;
        this.log('info', 'fsm', `${res.logMessage}. Simultaneous close detected!`, undefined, receiver.endpoint);

        const ackPkt = createAckPacket(
          receiver.endpoint,
          packet.source,
          receiver.sndNxt,
          receiver.rcvNxt,
          receiver.port,
          packet.srcPort
        );
        this.enqueuePacketDelivery(ackPkt);

        if (res.nextState === 'TIME_WAIT') {
          this.scheduleTimeWaitTimer(receiver.endpoint);
        }
      }
    } else if (receiver.state === 'FIN_WAIT_2') {
      // 4-way close final peer FIN
      const res = transition(receiver.state, 'RCV_FIN');
      if (res.isValid) {
        this.recordTransition(receiver.endpoint, receiver.state, res.nextState, 'RCV_FIN', res.rule?.id || '');
        receiver.state = res.nextState;
        this.log('info', 'fsm', `${res.logMessage}. Remote FIN received, transitioning to TIME_WAIT.`, undefined, receiver.endpoint);

        const ackPkt = createAckPacket(
          receiver.endpoint,
          packet.source,
          receiver.sndNxt,
          receiver.rcvNxt,
          receiver.port,
          packet.srcPort
        );
        this.enqueuePacketDelivery(ackPkt);
        this.scheduleTimeWaitTimer(receiver.endpoint);
      }
    }
  }

  private processRetransmitTimeout(endpointId: EndpointId): void {
    const tcb = endpointId === 'client' ? this.client : this.server;
    if (tcb.timerRetransmit === null || tcb.state === 'CLOSED') {
      return;
    }
    const dest = endpointId === 'client' ? 'server' : 'client';
    const peerPort = endpointId === 'client' ? this.server.port : this.client.port;

    if (tcb.retransmitCount >= tcb.maxRetransmits) {
      this.log('error', 'fsm', `Max retransmissions (${tcb.maxRetransmits}) exceeded! Aborting connection with ETIMEDOUT.`, undefined, endpointId);
      const res = transition(tcb.state, 'TIMEOUT_RTO');
      this.recordTransition(endpointId, tcb.state, res.nextState, 'TIMEOUT_RTO', res.rule?.id || '');
      tcb.state = res.nextState;
      tcb.timerRetransmit = null;
      return;
    }

    tcb.retransmitCount++;
    this.stats.retransmissions++;
    // Exponential backoff
    tcb.rto = Math.min(3200, tcb.rto * 2);

    this.log('warn', 'timer', `RTO fired for ${endpointId.toUpperCase()}! Retry #${tcb.retransmitCount}/${tcb.maxRetransmits}. Backing off RTO to ${tcb.rto}ms.`, undefined, endpointId);

    // Retransmit depending on state
    if (tcb.state === 'SYN_SENT') {
      const synPkt = createSynPacket(
        endpointId,
        dest,
        tcb.iss,
        tcb.port,
        peerPort,
        tcb.rcvWnd
      );
      synPkt.isRetransmission = true;
      this.enqueuePacketDelivery(synPkt);
      this.scheduleRetransmitTimer(endpointId);
    } else if (tcb.state === 'SYN_RECEIVED') {
      const synAck = createSynAckPacket(
        endpointId,
        dest,
        tcb.iss,
        tcb.rcvNxt,
        tcb.port,
        peerPort,
        tcb.rcvWnd
      );
      synAck.isRetransmission = true;
      this.enqueuePacketDelivery(synAck);
      this.scheduleRetransmitTimer(endpointId);
    } else if (tcb.state === 'ESTABLISHED') {
      // Retransmit oldest unacknowledged segment
      const unacked = tcb.sendQueue.find((s) => s.seq === tcb.sndUna) || tcb.sendQueue[0];
      if (unacked) {
        unacked.retries++;
        const dataPkt = createDataPacket(
          endpointId,
          dest,
          unacked.seq,
          tcb.rcvNxt,
          unacked.data,
          tcb.port,
          peerPort,
          true
        );
        this.enqueuePacketDelivery(dataPkt);
        this.scheduleRetransmitTimer(endpointId);
      }
    } else if (tcb.state === 'FIN_WAIT_1' || tcb.state === 'LAST_ACK') {
      const finPkt = createFinPacket(
        endpointId,
        dest,
        (tcb.sndNxt - 1) >>> 0,
        tcb.rcvNxt,
        tcb.port,
        peerPort
      );
      finPkt.isRetransmission = true;
      this.enqueuePacketDelivery(finPkt);
      this.scheduleRetransmitTimer(endpointId);
    }
  }

  private processTimeWaitTimeout(endpointId: EndpointId): void {
    const tcb = endpointId === 'client' ? this.client : this.server;
    if (tcb.state === 'TIME_WAIT') {
      const res = transition(tcb.state, 'TIMEOUT_TIME_WAIT');
      this.recordTransition(endpointId, tcb.state, res.nextState, 'TIMEOUT_TIME_WAIT', res.rule?.id || '');
      tcb.state = res.nextState;
      tcb.timerTimeWait = null;
      this.log('success', 'fsm', `2MSL TIME_WAIT expired: ${res.logMessage}. Socket released.`, undefined, endpointId);
    }
  }

  private evaluateFailures(packet: TcpPacket): 'DELIVER' | 'DROP' | 'CORRUPT' {
    for (const [type, config] of this.activeFailures.entries()) {
      if (!config.isActive) continue;

      if (type === 'packet_loss') {
        this.decrementFailureUses(type, config);
        return 'DROP';
      }

      if (type === 'missing_ack' && (packet.flags.ack && !packet.flags.syn && !packet.flags.fin && packet.length === 0)) {
        this.decrementFailureUses(type, config);
        return 'DROP';
      }

      if (type === 'packet_corrupt') {
        this.decrementFailureUses(type, config);
        return 'CORRUPT';
      }

      if (type === 'mid_connection_reset' && packet.type === 'DATA') {
        this.decrementFailureUses(type, config);
        // Inject an RST into the stream
        const rstPkt = createRstPacket(
          packet.source,
          packet.destination,
          packet.seqNum,
          packet.ackNum,
          packet.srcPort,
          packet.dstPort
        );
        this.enqueuePacketDelivery(rstPkt, 10);
      }
    }

    return 'DELIVER';
  }

  private decrementFailureUses(type: FailureType, config: FailureConfig): void {
    if (config.remainingUses !== undefined) {
      config.remainingUses--;
      if (config.remainingUses <= 0) {
        config.isActive = false;
        this.activeFailures.delete(type);
      }
    }
  }

  private recordTransition(
    endpoint: EndpointId,
    fromState: TcpState,
    toState: TcpState,
    event: any,
    edgeId: string
  ): void {
    this.lastTransition = {
      endpoint,
      fromState,
      toState,
      event,
      edgeId,
    };
  }

  private log(
    level: LogEntry['level'],
    category: LogEntry['category'],
    message: string,
    details?: Record<string, any>,
    endpoint?: EndpointId | 'network'
  ): void {
    const entry: LogEntry = {
      id: `LOG-${(this.logs.length + 1).toString().padStart(4, '0')}`,
      stepIndex: this.history.length,
      time: this.virtualTime,
      endpoint,
      level,
      category,
      message,
      details,
    };
    this.logs.push(entry);
  }

  private recordSnapshot(): void {
    const activeFailureEntry = Array.from(this.activeFailures.values()).find((f) => f.isActive);

    const snapshot: TcpSnapshot = {
      stepIndex: this.history.length,
      virtualTime: this.virtualTime,
      client: JSON.parse(JSON.stringify(this.client)),
      server: JSON.parse(JSON.stringify(this.server)),
      inFlightPackets: JSON.parse(JSON.stringify(this.inFlightPackets)),
      packetHistory: JSON.parse(JSON.stringify(this.packetHistory)),
      logs: JSON.parse(JSON.stringify(this.logs)),
      lastEventDescription: this.lastEventDesc,
      lastActiveTransition: this.lastTransition ? { ...this.lastTransition } : undefined,
      activeFailure: activeFailureEntry
        ? {
            type: activeFailureEntry.type,
            explanation: activeFailureEntry.explanation,
            cue: activeFailureEntry.visualCue.badge,
          }
        : undefined,
      stats: JSON.parse(JSON.stringify(this.stats)),
      canStepForward: this.eventQueue.length > 0,
    };

    this.history.push(Object.freeze(snapshot));
  }
}

/**
 * Invariant verification function according to user requirements.
 * Tests call this after every step of every scenario.
 */
export function verifyInvariants(snapshot: TcpSnapshot): void {
  // 1. Send sequence order: sndUna <= sndNxt (with 32-bit wrap awareness)
  const clientDiff = (snapshot.client.sndNxt - snapshot.client.sndUna) | 0;
  if (clientDiff < 0) {
    throw new Error(`Invariant Violation: Client sndUna (${snapshot.client.sndUna}) > sndNxt (${snapshot.client.sndNxt})`);
  }

  const serverDiff = (snapshot.server.sndNxt - snapshot.server.sndUna) | 0;
  if (serverDiff < 0) {
    throw new Error(`Invariant Violation: Server sndUna (${snapshot.server.sndUna}) > sndNxt (${snapshot.server.sndNxt})`);
  }

  // 2. Valid states in ALL_TCP_STATES
  if (!ALL_TCP_STATES.includes(snapshot.client.state)) {
    throw new Error(`Invariant Violation: Invalid client state "${snapshot.client.state}"`);
  }
  if (!ALL_TCP_STATES.includes(snapshot.server.state)) {
    throw new Error(`Invariant Violation: Invalid server state "${snapshot.server.state}"`);
  }

  // 3. No packet arrives before sent
  for (const pkt of snapshot.packetHistory) {
    if (pkt.deliverAtTime < pkt.sentAtTime) {
      throw new Error(`Invariant Violation: Packet ${pkt.id} deliverAtTime (${pkt.deliverAtTime}) < sentAtTime (${pkt.sentAtTime})`);
    }
  }

  // 4. Stats consistency
  const total = snapshot.stats.totalPacketsSent;
  const processed =
    snapshot.stats.packetsDelivered +
    snapshot.stats.packetsDropped +
    snapshot.stats.packetsCorrupted +
    snapshot.inFlightPackets.length;
  if (total !== processed) {
    throw new Error(`Invariant Violation: Total packets (${total}) != delivered (${snapshot.stats.packetsDelivered}) + dropped (${snapshot.stats.packetsDropped}) + corrupted (${snapshot.stats.packetsCorrupted}) + inFlight (${snapshot.inFlightPackets.length})`);
  }
}
