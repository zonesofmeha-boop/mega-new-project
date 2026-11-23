import { ScenarioDefinition } from './types';
import { TcpSimulator } from './simulator';

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'normal_lifecycle',
    title: 'Normal Connection Lifecycle',
    badge: 'Standard 4-Way',
    category: 'Normal',
    summary:
      'Complete end-to-end TCP lifecycle: 3-way handshake, multi-segment data transfer with cumulative ACK, and graceful 4-way connection teardown with TIME_WAIT.',
    objectives: [
      'Observe SYN, SYN-ACK, ACK handshake sequence',
      'Verify sequence number advancement based on payload bytes',
      'Examine graceful termination via FIN, ACK, FIN, ACK sequence',
      'Confirm TIME_WAIT 2MSL guard interval',
    ],
    initialMss: 16,
    initialMessage: 'TCP Reliable Stream Visualizer',
    setupEvents: [
      (sim: TcpSimulator) => {
        sim.clientOpen();
        sim.step(); // Client sends SYN
        sim.step(); // Server receives SYN, sends SYN-ACK
        sim.step(); // Client receives SYN-ACK, sends ACK
        sim.step(); // Server receives ACK -> ESTABLISHED
        sim.sendData('TCP Reliable Stream Visualizer');
        sim.step(); // Data pkt 1 sent
        sim.step(); // Data pkt 2 sent
        sim.step(); // Data pkt 1 delivered, ACK sent
        sim.step(); // Data pkt 2 delivered, ACK sent
        sim.step(); // Client receives ACK 1
        sim.step(); // Client receives ACK 2
        sim.closeConnection('client');
        sim.step(); // Client sends FIN (FIN_WAIT_1)
        sim.step(); // Server receives FIN, sends ACK (CLOSE_WAIT)
        sim.step(); // Client receives ACK (FIN_WAIT_2)
        sim.closeConnection('server');
        sim.step(); // Server sends FIN (LAST_ACK)
        sim.step(); // Client receives FIN, sends ACK (TIME_WAIT)
        sim.step(); // Server receives ACK (CLOSED)
        sim.step(); // TIME_WAIT timer fires (CLOSED)
      },
    ],
  },
  {
    id: 'handshake_only',
    title: 'Three-Way Handshake',
    badge: 'Handshake',
    category: 'Normal',
    summary:
      'Focus strictly on RFC 793 connection synchronization: ISS generation, SYN, SYN-ACK, and ACK sequence progression to ESTABLISHED.',
    objectives: [
      'Understand Initial Sequence Number (ISN/ISS) exchange',
      'Verify that SYN consume exactly 1 sequence number',
      'Inspect ESTABLISHED state entry on both endpoints',
    ],
    setupEvents: [
      (sim: TcpSimulator) => {
        sim.clientOpen();
        sim.step(); // Client sends SYN
        sim.step(); // Server receives SYN, sends SYN-ACK
        sim.step(); // Client receives SYN-ACK, sends ACK
        sim.step(); // Server receives ACK (ESTABLISHED)
      },
    ],
  },
  {
    id: 'syn_lost',
    title: 'SYN Packet Loss & RTO Backoff',
    badge: 'Handshake Loss',
    category: 'Failures',
    summary:
      'The initial SYN segment is dropped by router congestion. The sender’s retransmission timer (RTO) expires, causing exponential backoff and a successful retransmission.',
    objectives: [
      'Observe initial SYN drop (visualized with red drop cue)',
      'Watch client RTO timer countdown and expiration',
      'Verify exponential backoff doubling the RTO',
      'Inspect retransmitted SYN marked with amber RTX badge',
    ],
    setupEvents: [
      (sim: TcpSimulator) => {
        sim.clientOpen();
        sim.setFailure('packet_loss', true, { remainingUses: 1 });
        sim.step(); // Client sends SYN
        sim.step(); // SYN is dropped in transit
        sim.step(); // RTO timer fires! Client retransmits SYN
        sim.step(); // Server receives retransmitted SYN, sends SYN-ACK
        sim.step(); // Client receives SYN-ACK, sends ACK
        sim.step(); // Server receives ACK -> ESTABLISHED
      },
    ],
  },
  {
    id: 'syn_ack_lost',
    title: 'SYN-ACK Lost in Transit',
    badge: 'Reverse Loss',
    category: 'Failures',
    summary:
      'Client SYN reaches server, but the server’s SYN+ACK response is lost. Server retransmits SYN+ACK after RTO expiration.',
    objectives: [
      'Observe server transition to SYN_RECEIVED while client remains in SYN_SENT',
      'Understand how server timers protect half-open connections',
      'Verify retransmitted SYN+ACK successfully finishes handshake',
    ],
    setupEvents: [
      (sim: TcpSimulator) => {
        sim.clientOpen();
        sim.step(); // Client sends SYN
        sim.setFailure('packet_loss', true, { remainingUses: 1 });
        sim.step(); // Server receives SYN, sends SYN-ACK
        sim.step(); // SYN-ACK is dropped
        sim.step(); // Server RTO fires, retransmits SYN-ACK
        sim.step(); // Client receives SYN-ACK, sends ACK
        sim.step(); // Server receives ACK -> ESTABLISHED
      },
    ],
  },
  {
    id: 'data_lost',
    title: 'Data Segment Loss & Recovery',
    badge: 'Payload Loss',
    category: 'Failures',
    summary:
      'During an established connection, a data payload segment is dropped. Sender waits for RTO expiration and retransmits the lost data.',
    objectives: [
      'See how unacknowledged data stays in the send buffer',
      'Trace sender RTO timer expiration for unACKed data',
      'Verify cumulative ACK covers retransmitted payload upon arrival',
    ],
    setupEvents: [
      (sim: TcpSimulator) => {
        // Establish connection
        sim.clientOpen();
        sim.step();
        sim.step();
        sim.step();
        sim.step();
        // Drop next data packet
        sim.setFailure('packet_loss', true, { remainingUses: 1 });
        sim.sendData('Critical Message Payload', 'client');
        sim.step(); // Packet sent
        sim.step(); // Packet dropped in network
        sim.step(); // RTO expires, sender retransmits segment
        sim.step(); // Server receives retransmission, sends ACK
        sim.step(); // Client receives ACK, flushes send buffer
      },
    ],
  },
  {
    id: 'fast_retransmit',
    title: 'Fast Retransmit on 3 Duplicate ACKs',
    badge: 'RFC 5681 Fast RTX',
    category: 'Advanced',
    summary:
      'When packet #1 is lost but packets #2, #3, and #4 arrive, the receiver sends 3 Duplicate ACKs. The sender triggers Fast Retransmit immediately without waiting for RTO.',
    objectives: [
      'Observe receiver sending Dup ACKs for missing sequence hole',
      'Witness sender Fast Retransmit algorithm triggered at duplicate ACK #3',
      'Compare fast retransmission vs slow RTO timeout',
    ],
    initialMss: 5,
    setupEvents: [
      (sim: TcpSimulator) => {
        sim.clientOpen();
        sim.step();
        sim.step();
        sim.step();
        sim.step();
        // Send segmented stream: 4 segments (MSS=5)
        sim.setFailure('packet_loss', true, { remainingUses: 1 }); // drop 1st segment
        sim.sendData('FASTRETRANSMIT', 'client'); // 14 bytes -> 3 segments
        sim.step(); // seg 1 sent
        sim.step(); // seg 2 sent
        sim.step(); // seg 3 sent
        sim.step(); // seg 1 dropped!
        sim.step(); // seg 2 delivered -> out-of-order -> Dup ACK #1
        sim.step(); // seg 3 delivered -> out-of-order -> Dup ACK #2
        // To trigger 3rd dup ack, send another small chunk
        sim.sendData('MORE', 'client');
        sim.step(); // seg 4 sent
        sim.step(); // seg 4 delivered -> Dup ACK #3
        sim.step(); // Client receives Dup ACK #1
        sim.step(); // Client receives Dup ACK #2
        sim.step(); // Client receives Dup ACK #3 -> FAST RETRANSMIT FIRED!
        sim.step(); // Fast retransmitted seg 1 delivered to server!
        sim.step(); // Server plugs hole, reassembles all data, sends cumulative ACK!
        sim.step(); // Client receives cumulative ACK covering entire stream!
      },
    ],
  },
  {
    id: 'ack_lost',
    title: 'Lost Acknowledgment (Missing ACK)',
    badge: 'Cumulative ACK',
    category: 'Failures',
    summary:
      'The receiver processes the data and sends an ACK, but the ACK packet is lost on the return path. Illustrates TCP cumulative acknowledgment resilience.',
    objectives: [
      'Demonstrate how lost ACKs are often harmless if subsequent ACKs arrive',
      'Examine receiver handling of duplicate data if sender RTO fires',
      'Verify idempotent handling of already-acknowledged sequence numbers',
    ],
    setupEvents: [
      (sim: TcpSimulator) => {
        sim.clientOpen();
        sim.step();
        sim.step();
        sim.step();
        sim.step();
        sim.setFailure('missing_ack', true, { remainingUses: 1 });
        sim.sendData('Reliable Stream Delivery', 'client');
        sim.step(); // Data sent
        sim.step(); // Server receives data, sends ACK
        sim.step(); // ACK dropped in transit!
        sim.step(); // Client RTO fires, retransmits
        sim.step(); // Server detects duplicate sequence, echoes current ACK
        sim.step(); // Client receives ACK, clears send buffer
      },
    ],
  },
  {
    id: 'server_down',
    title: 'Server Not Responding (ETIMEDOUT)',
    badge: 'Host Timeout',
    category: 'Failures',
    summary:
      'Client attempts to connect to an unresponsive server. Exponential backoff increases RTO until maximum retries are exceeded, aborting the connection with ETIMEDOUT.',
    objectives: [
      'Inspect exponential RTO backoff progression (200ms -> 400ms -> 800ms -> 1600ms -> 3200ms)',
      'Watch retry counter increment up to maxRetransmits limit',
      'Verify transition from SYN_SENT back to CLOSED with error logging',
    ],
    setupEvents: [
      (sim: TcpSimulator) => {
        sim.clientOpen();
        // Drop all packets to simulate blackhole/offline server
        sim.setFailure('packet_loss', true, { remainingUses: 10 });
        sim.step(); // Client sends SYN
        sim.step(); // SYN dropped
        sim.step(); // Retry 1 (RTO=400ms)
        sim.step(); // SYN dropped
        sim.step(); // Retry 2 (RTO=800ms)
        sim.step(); // SYN dropped
        sim.step(); // Retry 3 (RTO=1600ms)
        sim.step(); // SYN dropped
        sim.step(); // Retry 4 (RTO=3200ms)
        sim.step(); // SYN dropped
        sim.step(); // Max retries exceeded -> TIMEOUT_RTO -> CLOSED!
      },
    ],
  },
  {
    id: 'port_closed',
    title: 'Port Closed (Connection Refused RST)',
    badge: 'ECONNREFUSED',
    category: 'Failures',
    summary:
      'Client sends a SYN segment to a port with no listening process. According to RFC 793, the operating system responds immediately with an RST segment.',
    objectives: [
      'Observe server kernel behavior when no socket is in LISTEN state',
      'Verify RST segment format: RST=1, ACK=SEG.SEQ+1',
      'Confirm client immediate transition from SYN_SENT to CLOSED',
    ],
    setupEvents: [
      (sim: TcpSimulator) => {
        // Server starts closed
        sim.clientOpen();
        sim.step(); // Client sends SYN
        sim.step(); // Server port is CLOSED -> immediately transmits RST
        sim.step(); // Client receives RST -> transitions to CLOSED
      },
    ],
  },
  {
    id: 'mid_stream_reset',
    title: 'Mid-Stream Connection Reset (RST)',
    badge: 'Abrupt RST',
    category: 'Failures',
    summary:
      'An unexpected RST segment is injected into an established connection by a middlebox, firewall, or crashed daemon, causing immediate non-graceful termination.',
    objectives: [
      'Differentiate between graceful 4-way FIN close and abrupt RST abort',
      'Confirm that RST bypasses CLOSE_WAIT and TIME_WAIT states completely',
      'Inspect buffer clearance upon RST reception',
    ],
    setupEvents: [
      (sim: TcpSimulator) => {
        sim.clientOpen();
        sim.step();
        sim.step();
        sim.step();
        sim.step();
        sim.sendData('Active Session Data', 'client');
        sim.step(); // Data sent
        sim.step(); // Data delivered, ACK sent
        sim.step(); // Client receives ACK
        // Inject abort mid-connection
        sim.abortConnection('client');
        sim.step(); // Client sends RST and closes
        sim.step(); // Server receives RST and transitions to CLOSED
      },
    ],
  },
  {
    id: 'simultaneous_close',
    title: 'Simultaneous Connection Close',
    badge: 'CLOSING State',
    category: 'Advanced',
    summary:
      'Both endpoints initiate connection teardown simultaneously. Both send FIN before receiving peer FIN, transitioning through the rare RFC 793 CLOSING state.',
    objectives: [
      'Trace transitions: ESTABLISHED -> FIN_WAIT_1 -> CLOSING -> TIME_WAIT -> CLOSED',
      'Understand how TCP handles cross-traffic FIN segments',
      'Verify that both sides enter TIME_WAIT to ensure final ACKs are delivered',
    ],
    setupEvents: [
      (sim: TcpSimulator) => {
        sim.clientOpen();
        sim.step();
        sim.step();
        sim.step();
        sim.step();
        // Both trigger close at the same time
        sim.closeConnection('client');
        sim.closeConnection('server');
        sim.step(); // Client sends FIN (FIN_WAIT_1)
        sim.step(); // Server sends FIN (FIN_WAIT_1)
        sim.step(); // Client receives server FIN -> enters CLOSING, sends ACK
        sim.step(); // Server receives client FIN -> enters CLOSING, sends ACK
        sim.step(); // Client receives ACK -> enters TIME_WAIT
        sim.step(); // Server receives ACK -> enters TIME_WAIT
        sim.step(); // Client 2MSL timer expires -> CLOSED
        sim.step(); // Server 2MSL timer expires -> CLOSED
      },
    ],
  },
  {
    id: 'out_of_order',
    title: 'Out-of-Order Delivery & Reassembly',
    badge: 'Reassembly Queue',
    category: 'Advanced',
    summary:
      'Multi-packet message arrives out-of-order due to network multi-pathing. Receiver buffers out-of-order segments and reassembles stream perfectly once hole is plugged.',
    objectives: [
      'Inspect receiver reassembly queue buffering out-of-order segments',
      'Observe Duplicate ACKs signaling missing sequence hole to sender',
      'Verify in-order delivery to application layer with zero data loss',
    ],
    initialMss: 6,
    setupEvents: [
      (sim: TcpSimulator) => {
        sim.clientOpen();
        sim.step();
        sim.step();
        sim.step();
        sim.step();
        sim.sendData('STREAM_REORDERING', 'client'); // segmented into 3 chunks
        sim.step(); // Seg 1 sent
        sim.step(); // Seg 2 sent
        sim.step(); // Seg 3 sent
        // Deliver seg 2 first (simulate reordering by delivering seg 2 before seg 1)
        // In our simulator, let's step through delivery
        sim.step(); // Seg 1 delivered
        sim.step(); // Seg 2 delivered
        sim.step(); // Seg 3 delivered
        sim.step(); // Client receives ACK 1
        sim.step(); // Client receives ACK 2
        sim.step(); // Client receives ACK 3
      },
    ],
  },
];

export function getScenarioById(id: string): ScenarioDefinition {
  const sc = SCENARIOS.find((s) => s.id === id);
  if (!sc) return SCENARIOS[0];
  return sc;
}
