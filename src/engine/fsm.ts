import { TcpState, TcpEvent, ALL_TCP_STATES } from './types';

export interface TransitionRule {
  id: string;
  from: TcpState;
  event: TcpEvent;
  to: TcpState;
  action: string;
  rfcDescription: string;
  isSimultaneous?: boolean;
  isReset?: boolean;
  isTimeout?: boolean;
}

export const TCP_FSM_TRANSITIONS: readonly TransitionRule[] = [
  // CLOSED
  {
    id: 'T_CLOSED_PASSIVE',
    from: 'CLOSED',
    event: 'APP_OPEN_PASSIVE',
    to: 'LISTEN',
    action: 'Create TCB, enter passive listen',
    rfcDescription: 'Server binds to port and enters passive listening mode waiting for incoming SYNs.',
  },
  {
    id: 'T_CLOSED_ACTIVE',
    from: 'CLOSED',
    event: 'APP_OPEN_ACTIVE',
    to: 'SYN_SENT',
    action: 'Send SYN, set RTO timer',
    rfcDescription: 'Client initiates connection: allocates ISS, sends SYN segment, sets retransmit timer.',
  },

  // LISTEN
  {
    id: 'T_LISTEN_RCV_SYN',
    from: 'LISTEN',
    event: 'RCV_SYN',
    to: 'SYN_RECEIVED',
    action: 'Send SYN+ACK, record IRS, set RTO',
    rfcDescription: 'Received SYN: allocate ISS, record peer IRS, send SYN+ACK with ACK=IRS+1, set timer.',
  },
  {
    id: 'T_LISTEN_CLOSE',
    from: 'LISTEN',
    event: 'APP_CLOSE',
    to: 'CLOSED',
    action: 'Delete TCB',
    rfcDescription: 'Application stops listening; socket deleted.',
  },
  {
    id: 'T_LISTEN_SEND',
    from: 'LISTEN',
    event: 'APP_SEND',
    to: 'SYN_SENT',
    action: 'Send SYN',
    rfcDescription: 'Application issues active send from listening state, transitioning to SYN_SENT.',
  },

  // SYN_SENT
  {
    id: 'T_SYN_SENT_RCV_SYN_ACK',
    from: 'SYN_SENT',
    event: 'RCV_SYN_ACK',
    to: 'ESTABLISHED',
    action: 'Send ACK, cancel SYN timer',
    rfcDescription: 'Received SYN+ACK: handshake completed! Send ACK with ACK=IRS+1, connection is ESTABLISHED.',
  },
  {
    id: 'T_SYN_SENT_RCV_SYN',
    from: 'SYN_SENT',
    event: 'RCV_SYN',
    to: 'SYN_RECEIVED',
    action: 'Send SYN+ACK',
    rfcDescription: 'Simultaneous Open: received SYN while in SYN_SENT. Send SYN+ACK and enter SYN_RECEIVED.',
    isSimultaneous: true,
  },
  {
    id: 'T_SYN_SENT_RCV_RST',
    from: 'SYN_SENT',
    event: 'RCV_RST',
    to: 'CLOSED',
    action: 'Connection refused',
    rfcDescription: 'Received RST: Remote port is closed or connection was refused.',
    isReset: true,
  },
  {
    id: 'T_SYN_SENT_CLOSE',
    from: 'SYN_SENT',
    event: 'APP_CLOSE',
    to: 'CLOSED',
    action: 'Delete TCB',
    rfcDescription: 'Application aborted pending connection attempt.',
  },
  {
    id: 'T_SYN_SENT_TIMEOUT',
    from: 'SYN_SENT',
    event: 'TIMEOUT_RTO',
    to: 'CLOSED',
    action: 'Abort with timeout error',
    rfcDescription: 'SYN retransmit counter exceeded max attempts; connection failed.',
    isTimeout: true,
  },

  // SYN_RECEIVED
  {
    id: 'T_SYN_RCVD_RCV_ACK',
    from: 'SYN_RECEIVED',
    event: 'RCV_ACK',
    to: 'ESTABLISHED',
    action: 'Handshake complete',
    rfcDescription: 'Received ACK for SYN+ACK: 3-way handshake finished! Connection is ESTABLISHED.',
  },
  {
    id: 'T_SYN_RCVD_CLOSE',
    from: 'SYN_RECEIVED',
    event: 'APP_CLOSE',
    to: 'FIN_WAIT_1',
    action: 'Send FIN',
    rfcDescription: 'Application closed before handshake completed; send FIN to peer.',
  },
  {
    id: 'T_SYN_RCVD_RCV_RST',
    from: 'SYN_RECEIVED',
    event: 'RCV_RST',
    to: 'LISTEN',
    action: 'Return to listen or close',
    rfcDescription: 'Received RST during handshake: peer aborted; server reverts to LISTEN state.',
    isReset: true,
  },

  // ESTABLISHED
  {
    id: 'T_ESTAB_CLOSE',
    from: 'ESTABLISHED',
    event: 'APP_CLOSE',
    to: 'FIN_WAIT_1',
    action: 'Send FIN, set RTO timer',
    rfcDescription: 'Active Close: local application closes connection. Flush buffers, send FIN segment.',
  },
  {
    id: 'T_ESTAB_RCV_FIN',
    from: 'ESTABLISHED',
    event: 'RCV_FIN',
    to: 'CLOSE_WAIT',
    action: 'Send ACK, notify application',
    rfcDescription: 'Passive Close: received FIN from peer. Send ACK, notify application that remote side closed.',
  },
  {
    id: 'T_ESTAB_RCV_RST',
    from: 'ESTABLISHED',
    event: 'RCV_RST',
    to: 'CLOSED',
    action: 'Connection reset',
    rfcDescription: 'Received RST: Remote peer aborted connection abruptly.',
    isReset: true,
  },
  {
    id: 'T_ESTAB_ABORT',
    from: 'ESTABLISHED',
    event: 'APP_ABORT',
    to: 'CLOSED',
    action: 'Send RST, delete TCB',
    rfcDescription: 'Application triggered abort: send RST segment and delete connection immediately.',
    isReset: true,
  },

  // FIN_WAIT_1
  {
    id: 'T_FIN_WAIT_1_RCV_ACK',
    from: 'FIN_WAIT_1',
    event: 'RCV_ACK',
    to: 'FIN_WAIT_2',
    action: 'Cancel FIN timer, wait for remote FIN',
    rfcDescription: 'Received ACK for our FIN: remote acknowledged our close. Awaiting remote peer FIN.',
  },
  {
    id: 'T_FIN_WAIT_1_RCV_FIN',
    from: 'FIN_WAIT_1',
    event: 'RCV_FIN',
    to: 'CLOSING',
    action: 'Send ACK',
    rfcDescription: 'Simultaneous Close: received peer FIN before receiving ACK for our FIN. Send ACK, enter CLOSING.',
    isSimultaneous: true,
  },
  {
    id: 'T_FIN_WAIT_1_RCV_FIN_ACK',
    from: 'FIN_WAIT_1',
    event: 'RCV_FIN_ACK',
    to: 'TIME_WAIT',
    action: 'Send ACK, start 2MSL timer',
    rfcDescription: 'Received combined FIN+ACK: our FIN is acknowledged and peer is closing. Send ACK, enter TIME_WAIT.',
  },
  {
    id: 'T_FIN_WAIT_1_RCV_RST',
    from: 'FIN_WAIT_1',
    event: 'RCV_RST',
    to: 'CLOSED',
    action: 'Delete TCB',
    rfcDescription: 'Received RST in FIN_WAIT_1; connection closed.',
    isReset: true,
  },

  // FIN_WAIT_2
  {
    id: 'T_FIN_WAIT_2_RCV_FIN',
    from: 'FIN_WAIT_2',
    event: 'RCV_FIN',
    to: 'TIME_WAIT',
    action: 'Send ACK, start 2MSL timer',
    rfcDescription: 'Received peer FIN: both directions now closed. Send ACK, start TIME_WAIT timer to absorb straggler packets.',
  },
  {
    id: 'T_FIN_WAIT_2_RCV_RST',
    from: 'FIN_WAIT_2',
    event: 'RCV_RST',
    to: 'CLOSED',
    action: 'Delete TCB',
    rfcDescription: 'Received RST in FIN_WAIT_2; connection closed.',
    isReset: true,
  },

  // CLOSE_WAIT
  {
    id: 'T_CLOSE_WAIT_CLOSE',
    from: 'CLOSE_WAIT',
    event: 'APP_CLOSE',
    to: 'LAST_ACK',
    action: 'Send FIN, set RTO timer',
    rfcDescription: 'Local application finished sending its remaining data and closes. Send FIN to peer.',
  },
  {
    id: 'T_CLOSE_WAIT_RCV_RST',
    from: 'CLOSE_WAIT',
    event: 'RCV_RST',
    to: 'CLOSED',
    action: 'Delete TCB',
    rfcDescription: 'Received RST in CLOSE_WAIT; connection closed.',
    isReset: true,
  },

  // CLOSING
  {
    id: 'T_CLOSING_RCV_ACK',
    from: 'CLOSING',
    event: 'RCV_ACK',
    to: 'TIME_WAIT',
    action: 'Start 2MSL timer',
    rfcDescription: 'Received ACK for our FIN in simultaneous close. Start 2MSL TIME_WAIT timer.',
    isSimultaneous: true,
  },
  {
    id: 'T_CLOSING_RCV_RST',
    from: 'CLOSING',
    event: 'RCV_RST',
    to: 'CLOSED',
    action: 'Delete TCB',
    rfcDescription: 'Received RST in CLOSING; connection closed.',
    isReset: true,
  },

  // LAST_ACK
  {
    id: 'T_LAST_ACK_RCV_ACK',
    from: 'LAST_ACK',
    event: 'RCV_ACK',
    to: 'CLOSED',
    action: 'Delete TCB',
    rfcDescription: 'Received ACK for our FIN: graceful close completed on both ends. Socket closed.',
  },
  {
    id: 'T_LAST_ACK_RCV_RST',
    from: 'LAST_ACK',
    event: 'RCV_RST',
    to: 'CLOSED',
    action: 'Delete TCB',
    rfcDescription: 'Received RST in LAST_ACK; connection closed.',
    isReset: true,
  },

  // TIME_WAIT
  {
    id: 'T_TIME_WAIT_TIMEOUT',
    from: 'TIME_WAIT',
    event: 'TIMEOUT_TIME_WAIT',
    to: 'CLOSED',
    action: 'Delete TCB',
    rfcDescription: '2MSL timer expired: safe to release port and delete connection state.',
    isTimeout: true,
  },
  {
    id: 'T_TIME_WAIT_RCV_RST',
    from: 'TIME_WAIT',
    event: 'RCV_RST',
    to: 'CLOSED',
    action: 'Delete TCB',
    rfcDescription: 'Received RST in TIME_WAIT; connection closed immediately.',
    isReset: true,
  },
];

export interface FsmTransitionResult {
  nextState: TcpState;
  rule?: TransitionRule;
  isValid: boolean;
  logMessage: string;
}

/**
 * Pure table-driven FSM transition function.
 * RFC 793 compliant: NEVER throws. Invalid transitions leave state unchanged and return isValid=false.
 */
export function transition(currentState: TcpState, event: TcpEvent): FsmTransitionResult {
  const match = TCP_FSM_TRANSITIONS.find(
    (t) => t.from === currentState && t.event === event
  );

  if (match) {
    return {
      nextState: match.to,
      rule: match,
      isValid: true,
      logMessage: `FSM: Transitioned ${currentState} -> ${match.to} on event ${event} (${match.action})`,
    };
  }

  return {
    nextState: currentState,
    isValid: false,
    logMessage: `FSM [Ignored/Invalid]: No transition defined for state ${currentState} on event ${event}. State remains ${currentState}.`,
  };
}

/**
 * Node and Edge generation for React Flow diagrams based directly on the FSM transition table.
 */
export interface FlowNode {
  id: string;
  type: string;
  data: {
    label: string;
    sublabel?: string;
    isActive?: boolean;
    isClient?: boolean;
    isServer?: boolean;
  };
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  animated?: boolean;
  style?: Record<string, any>;
  data?: {
    event: TcpEvent;
    action: string;
    description: string;
  };
}

// Fixed visual coordinates carefully tuned for clear, collision-free layout of all 11 states
const STATE_POSITIONS: Record<TcpState, { x: number; y: number }> = {
  CLOSED: { x: 340, y: 30 },
  LISTEN: { x: 140, y: 130 },
  SYN_SENT: { x: 540, y: 130 },
  SYN_RECEIVED: { x: 220, y: 250 },
  ESTABLISHED: { x: 380, y: 360 },
  FIN_WAIT_1: { x: 560, y: 470 },
  FIN_WAIT_2: { x: 560, y: 600 },
  CLOSING: { x: 380, y: 550 },
  TIME_WAIT: { x: 380, y: 720 },
  CLOSE_WAIT: { x: 150, y: 470 },
  LAST_ACK: { x: 150, y: 620 },
};

export function getFsmGraphData(activeState: TcpState, lastEdgeId?: string): {
  nodes: FlowNode[];
  edges: FlowEdge[];
} {
  const nodes: FlowNode[] = ALL_TCP_STATES.map((state) => ({
    id: state,
    type: 'tcpStateNode',
    data: {
      label: state,
      isActive: state === activeState,
    },
    position: STATE_POSITIONS[state] || { x: 0, y: 0 },
  }));

  const edges: FlowEdge[] = TCP_FSM_TRANSITIONS.map((t) => {
    const isHighlighted = lastEdgeId === t.id;
    return {
      id: t.id,
      source: t.from,
      target: t.to,
      label: t.event.replace(/^(APP_|RCV_|TIMEOUT_)/, ''),
      animated: isHighlighted,
      style: isHighlighted
        ? { stroke: '#3b82f6', strokeWidth: 3.5, strokeDasharray: '4 2' }
        : { stroke: '#64748b', strokeWidth: 1.5 },
      data: {
        event: t.event,
        action: t.action,
        description: t.rfcDescription,
      },
    };
  });

  return { nodes, edges };
}
