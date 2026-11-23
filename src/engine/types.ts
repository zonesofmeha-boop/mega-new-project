/**
 * Pure TypeScript definitions for the TCP Protocol Engine.
 * Strict RFC 793 compliance without external UI / React dependencies.
 */

export type EndpointId = 'client' | 'server';

export type TcpState =
  | 'CLOSED'
  | 'LISTEN'
  | 'SYN_SENT'
  | 'SYN_RECEIVED'
  | 'ESTABLISHED'
  | 'FIN_WAIT_1'
  | 'FIN_WAIT_2'
  | 'CLOSE_WAIT'
  | 'CLOSING'
  | 'LAST_ACK'
  | 'TIME_WAIT';

export const ALL_TCP_STATES: readonly TcpState[] = [
  'CLOSED',
  'LISTEN',
  'SYN_SENT',
  'SYN_RECEIVED',
  'ESTABLISHED',
  'FIN_WAIT_1',
  'FIN_WAIT_2',
  'CLOSE_WAIT',
  'CLOSING',
  'LAST_ACK',
  'TIME_WAIT',
] as const;

export type TcpEvent =
  | 'APP_OPEN_ACTIVE'    // Client initiates connection
  | 'APP_OPEN_PASSIVE'   // Server starts listening
  | 'APP_SEND'           // Application sends data
  | 'APP_CLOSE'          // Application requests close
  | 'APP_ABORT'          // Application resets connection
  | 'RCV_SYN'            // Received SYN segment
  | 'RCV_ACK'            // Received ACK segment
  | 'RCV_SYN_ACK'        // Received SYN+ACK segment
  | 'RCV_FIN'            // Received FIN segment
  | 'RCV_FIN_ACK'        // Received FIN+ACK segment
  | 'RCV_RST'            // Received RST segment
  | 'RCV_DATA'           // Received DATA segment
  | 'TIMEOUT_RTO'        // Retransmission timeout fired
  | 'TIMEOUT_TIME_WAIT'; // 2MSL TIME_WAIT timer expired

export interface TcpFlags {
  urg: boolean;
  ack: boolean;
  psh: boolean;
  rst: boolean;
  syn: boolean;
  fin: boolean;
}

export type PacketType =
  | 'SYN'
  | 'SYN_ACK'
  | 'ACK'
  | 'DATA'
  | 'FIN'
  | 'FIN_ACK'
  | 'RST'
  | 'DUP_ACK';

export interface TcpPacket {
  id: string;
  source: EndpointId;
  destination: EndpointId;
  srcPort: number;
  dstPort: number;
  seqNum: number;
  ackNum: number;
  flags: TcpFlags;
  type: PacketType;
  payload: string;
  length: number;           // payload byte length
  windowSize: number;       // advertised receive window
  checksum: number;         // 16-bit internet checksum
  urgentPointer: number;
  dataOffset: number;       // header length in 32-bit words (usually 5)
  options?: string;
  hexDump?: string;

  // Simulation transit metadata
  sentAtTime: number;       // Virtual tick when packet was sent
  deliverAtTime: number;    // Virtual tick when packet should be delivered
  isRetransmission?: boolean;
  isCorrupted?: boolean;
  isDropped?: boolean;
  dropReason?: string;
  status: 'in-flight' | 'delivered' | 'dropped' | 'corrupted';
}

export interface BufferSegment {
  seq: number;
  data: string;
  length: number;
  sentTime?: number;
  retries: number;
}

export interface TCB {
  endpoint: EndpointId;
  ip: string;
  port: number;
  state: TcpState;

  // Send sequence variables (RFC 793 Section 3.2)
  sndUna: number;           // Send unacknowledged
  sndNxt: number;           // Send next
  sndWnd: number;           // Send window size
  sndUp: number;            // Send urgent pointer
  sndWl1: number;           // Segment sequence number used for last window update
  sndWl2: number;           // Segment acknowledgment number used for last window update
  iss: number;              // Initial send sequence number

  // Receive sequence variables (RFC 793 Section 3.2)
  rcvNxt: number;           // Receive next (expected next sequence number)
  rcvWnd: number;           // Receive window size advertised to peer
  rcvUp: number;            // Receive urgent pointer
  irs: number;              // Initial receive sequence number

  // Timers & RTO
  rto: number;              // Current retransmission timeout in virtual ms
  srtt: number;             // Smoothed Round Trip Time
  rttvar: number;           // RTT variation
  timerRetransmit: number | null; // Scheduled tick for retransmission
  timerTimeWait: number | null;   // Scheduled tick for 2MSL TIME_WAIT expiration
  retransmitCount: number;
  maxRetransmits: number;

  // Buffers
  sendQueue: BufferSegment[];      // Data queued or awaiting ACK
  receiveQueue: BufferSegment[];   // Out-of-order segments awaiting reassembly
  deliveredData: string;          // In-order application data stream received
  dupAckCount: number;             // Consecutive duplicate ACKs received for sndUna
  fastRetransmitTriggered: boolean;
  mss: number;                     // Maximum Segment Size in bytes
}

export type FailureType =
  | 'none'
  | 'packet_loss'
  | 'packet_delay'
  | 'packet_duplicate'
  | 'packet_corrupt'
  | 'missing_ack'
  | 'server_timeout'
  | 'port_closed'
  | 'mid_connection_reset'
  | 'packet_reorder';

export interface FailureConfig {
  type: FailureType;
  title: string;
  targetDirection?: 'client_to_server' | 'server_to_client' | 'both';
  targetPacketType?: PacketType | 'any';
  delayAmount?: number;     // Additional ticks
  probability?: number;    // 0 to 1
  remainingUses?: number;   // E.g. trigger on next 1 packet
  isActive: boolean;
  visualCue: {
    badge: string;
    badgeColor: string;
    icon: string;
  };
  explanation: string;
  recoveryMechanism: string;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
  id: string;
  stepIndex: number;
  time: number;
  endpoint?: EndpointId | 'network';
  level: LogLevel;
  category: 'fsm' | 'packet' | 'timer' | 'buffer' | 'failure' | 'app';
  message: string;
  details?: Record<string, any>;
}

export interface FsmTransitionRecord {
  id: string;
  fromState: TcpState;
  toState: TcpState;
  event: TcpEvent;
  actionSummary: string;
  description: string;
}

export interface SimulationStats {
  totalPacketsSent: number;
  packetsDelivered: number;
  packetsDropped: number;
  packetsCorrupted: number;
  retransmissions: number;
  dupAcks: number;
  bytesTransferred: number;
  averageRtt: number;
  currentRtt: number;
  rttHistory: Array<{ step: number; rtt: number }>;
  packetTypeCounts: Record<PacketType, number>;
}

export interface TcpSnapshot {
  stepIndex: number;
  virtualTime: number;
  client: TCB;
  server: TCB;
  inFlightPackets: TcpPacket[];
  packetHistory: TcpPacket[];
  logs: LogEntry[];
  lastEventDescription: string;
  lastActiveTransition?: {
    endpoint: EndpointId;
    fromState: TcpState;
    toState: TcpState;
    event: TcpEvent;
    edgeId: string;
  };
  activeFailure?: {
    type: FailureType;
    explanation: string;
    cue: string;
  };
  stats: SimulationStats;
  canStepForward: boolean;
}

export interface ScenarioDefinition {
  id: string;
  title: string;
  badge: string;
  category: 'Normal' | 'Failures' | 'Advanced';
  summary: string;
  objectives: string[];
  initialMss?: number;
  initialMessage?: string;
  failuresToInject?: Partial<FailureConfig>[];
  setupEvents?: Array<(sim: any) => void>;
}
