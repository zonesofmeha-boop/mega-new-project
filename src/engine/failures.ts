import { FailureConfig, FailureType } from './types';

export const FAILURE_DEFINITIONS: Record<FailureType, FailureConfig> = {
  none: {
    type: 'none',
    title: 'No Active Failures',
    isActive: false,
    visualCue: {
      badge: 'NORMAL',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      icon: 'CheckCircle',
    },
    explanation: 'Standard network conditions: low latency, zero packet loss, segments arrive strictly in-order.',
    recoveryMechanism: 'None required.',
  },
  packet_loss: {
    type: 'packet_loss',
    title: 'Packet Loss',
    remainingUses: 1,
    isActive: false,
    visualCue: {
      badge: 'DROPPED (RED X)',
      badgeColor: 'bg-red-500/20 text-red-400 border-red-500/30',
      icon: 'XCircle',
    },
    explanation:
      'A packet was completely discarded by an intermediary router, simulating buffer bloat congestion or bad physical links.',
    recoveryMechanism:
      'The sender’s Retransmission Timer (RTO) ticks down. When it expires, TCP doubles RTO (exponential backoff) and retransmits the lost segment.',
  },
  packet_delay: {
    type: 'packet_delay',
    title: 'High Packet Delay / Jitter',
    delayAmount: 150, // virtual ms
    remainingUses: 1,
    isActive: false,
    visualCue: {
      badge: 'DELAYED (+150ms)',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      icon: 'Clock',
    },
    explanation:
      'A segment experiences excessive transit latency due to path rerouting, queue congestion, or satellite hops.',
    recoveryMechanism:
      'If delay exceeds RTO, a spurious retransmission occurs. TCP uses Jacobson/Karels algorithm to update SRTT and RTTVAR.',
  },
  packet_duplicate: {
    type: 'packet_duplicate',
    title: 'Duplicate Packet',
    remainingUses: 1,
    isActive: false,
    visualCue: {
      badge: 'DUPLICATE (2x)',
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      icon: 'Copy',
    },
    explanation:
      'Multipath routing or aggressive link-layer ARQ causes the receiver to receive the same sequence range twice.',
    recoveryMechanism:
      'The receiver detects SEQ < RCV.NXT (or already seen), silently drops the duplicate data bytes, and echoes an immediate ACK with current RCV.NXT.',
  },
  packet_corrupt: {
    type: 'packet_corrupt',
    title: 'Corrupted Checksum',
    remainingUses: 1,
    isActive: false,
    visualCue: {
      badge: 'CORRUPTED (BAD CHK)',
      badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      icon: 'AlertTriangle',
    },
    explanation:
      'Electrical noise or a faulty network interface card flipped bits in the TCP segment, causing 16-bit Internet Checksum verification to fail.',
    recoveryMechanism:
      'RFC 793 dictates silent discard of checksum-invalid segments. The receiver does not reply. The sender recovers via RTO timeout retransmission.',
  },
  missing_ack: {
    type: 'missing_ack',
    title: 'Dropped Acknowledgment (Missing ACK)',
    remainingUses: 1,
    isActive: false,
    visualCue: {
      badge: 'LOST ACK',
      badgeColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      icon: 'ShieldAlert',
    },
    explanation:
      'The receiver processed the data and sent an ACK, but the ACK was dropped on the return path.',
    recoveryMechanism:
      'Because TCP ACKs are cumulative, if a subsequent ACK arrives, the missing ACK is automatically covered. Otherwise, sender RTO fires and retransmits.',
  },
  server_timeout: {
    type: 'server_timeout',
    title: 'Server Not Responding (Timeout)',
    remainingUses: 1,
    isActive: false,
    visualCue: {
      badge: 'TIMEOUT (NO-REPLY)',
      badgeColor: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
      icon: 'ServerOff',
    },
    explanation:
      'The remote host is offline, experiencing kernel freeze, or firewalled with DROP policy.',
    recoveryMechanism:
      'Sender retransmits with exponential RTO backoff (e.g. 200ms -> 400ms -> 800ms). Once MAX_RETRANSMITS (typically 3-5 in simulator) is exceeded, the connection is aborted with ETIMEDOUT.',
  },
  port_closed: {
    type: 'port_closed',
    title: 'Connection Refused (Port Closed)',
    remainingUses: 1,
    isActive: false,
    visualCue: {
      badge: 'PORT CLOSED (RST)',
      badgeColor: 'bg-red-600/20 text-red-500 border-red-600/30',
      icon: 'Lock',
    },
    explanation:
      'Client sent a SYN to a destination port where no application is listening (no LISTEN TCB exists).',
    recoveryMechanism:
      'According to RFC 793 Section 3.4, the operating system kernel immediately responds with an RST segment (SEQ=0, ACK=SEG.SEQ+1, RST=1). Client transitions to CLOSED (ECONNREFUSED).',
  },
  mid_connection_reset: {
    type: 'mid_connection_reset',
    title: 'Mid-Stream Connection Reset',
    remainingUses: 1,
    isActive: false,
    visualCue: {
      badge: 'RST INJECTED',
      badgeColor: 'bg-amber-600/20 text-amber-500 border-amber-600/30',
      icon: 'ZapOff',
    },
    explanation:
      'A stateful firewall, middlebox, or crashed application process injects an unprovoked RST segment into an active ESTABLISHED connection.',
    recoveryMechanism:
      'Receiving a valid in-window RST forces immediate teardown. The socket transitions directly to CLOSED without the 4-way FIN teardown or TIME_WAIT.',
  },
  packet_reorder: {
    type: 'packet_reorder',
    title: 'Packet Reordering (Out-of-Order)',
    remainingUses: 1,
    isActive: false,
    visualCue: {
      badge: 'OUT OF ORDER',
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      icon: 'Shuffle',
    },
    explanation:
      'Segments travel across divergent ECMP routes or asymmetric paths, arriving out of sequential order at the receiver.',
    recoveryMechanism:
      'The receiver buffers the higher segment in its reassembly queue, but sends duplicate ACKs indicating the exact sequence hole (RCV.NXT). If 3 duplicate ACKs arrive, sender triggers Fast Retransmit without waiting for RTO!',
  },
};

export function getFailureConfig(type: FailureType): FailureConfig {
  return JSON.parse(JSON.stringify(FAILURE_DEFINITIONS[type] || FAILURE_DEFINITIONS.none));
}
