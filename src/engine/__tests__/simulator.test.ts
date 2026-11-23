import { describe, it, expect } from 'vitest';
import { TcpSimulator, verifyInvariants } from '../simulator';
import { SCENARIOS } from '../scenarios';
import { segmentMessage } from '../packet';

describe('Deterministic TCP Protocol Engine', () => {
  it('correctly calculates handshake SEQ and ACK values according to RFC 793', () => {
    const sim = new TcpSimulator({ seed: 42, serverStartsInListen: true });

    sim.clientOpen();
    const snap1 = sim.step(); // Client sends SYN
    const synPkt = snap1.packetHistory.find((p) => p.type === 'SYN')!;
    expect(synPkt).toBeDefined();
    expect(synPkt.seqNum).toBe(snap1.client.iss);
    expect(snap1.client.state).toBe('SYN_SENT');

    const snap2 = sim.step(); // Server receives SYN, sends SYN-ACK
    const synAckPkt = snap2.packetHistory.find((p) => p.type === 'SYN_ACK')!;
    expect(synAckPkt).toBeDefined();
    expect(synAckPkt.seqNum).toBe(snap2.server.iss);
    expect(synAckPkt.ackNum).toBe(synPkt.seqNum + 1); // SYN consumes 1 seq
    expect(snap2.server.state).toBe('SYN_RECEIVED');

    const snap3 = sim.step(); // Client receives SYN-ACK, sends ACK
    const ackPkt = snap3.packetHistory.find((p) => p.type === 'ACK')!;
    expect(ackPkt).toBeDefined();
    expect(ackPkt.ackNum).toBe(synAckPkt.seqNum + 1); // SYN-ACK consumes 1 seq
    expect(snap3.client.state).toBe('ESTABLISHED');

    const snap4 = sim.step(); // Server receives ACK
    expect(snap4.server.state).toBe('ESTABLISHED');
  });

  it('correctly segments payloads by MSS and reassembles stream in-order', () => {
    const segments = segmentMessage('1234567890ABCDEF', 5, 1000);
    expect(segments).toHaveLength(4);
    expect(segments[0].data).toBe('12345');
    expect(segments[0].seq).toBe(1000);
    expect(segments[1].data).toBe('67890');
    expect(segments[1].seq).toBe(1005);
    expect(segments[2].data).toBe('ABCDE');
    expect(segments[2].seq).toBe(1010);
    expect(segments[3].data).toBe('F');
    expect(segments[3].seq).toBe(1015);
  });

  it('handles packet retransmission and exponential RTO backoff', () => {
    const sim = new TcpSimulator({ seed: 99, serverStartsInListen: true });
    sim.clientOpen();
    sim.setFailure('packet_loss', true, { remainingUses: 1 });

    sim.step(); // Client sends SYN
    sim.step(); // SYN is dropped in transit
    const dropSnap = sim.getSnapshot();
    expect(dropSnap.stats.packetsDropped).toBe(1);

    const initialRto = dropSnap.client.rto;
    sim.step(); // RTO fires, retransmission
    const rtxSnap = sim.getSnapshot();

    expect(rtxSnap.stats.retransmissions).toBe(1);
    expect(rtxSnap.client.rto).toBe(initialRto * 2); // Exponential backoff!
  });

  it('handles port closed by immediately generating an RST segment', () => {
    const sim = new TcpSimulator({ seed: 10, serverStartsInListen: false }); // Port closed
    sim.clientOpen();
    sim.step(); // Client sends SYN
    sim.step(); // Server receives SYN on closed port -> responds with RST
    const rstSnap = sim.getSnapshot();
    const rstPkt = rstSnap.packetHistory.find((p) => p.type === 'RST')!;
    expect(rstPkt).toBeDefined();
    expect(rstPkt.flags.rst).toBe(true);

    sim.step(); // Client receives RST
    const closedSnap = sim.getSnapshot();
    expect(closedSnap.client.state).toBe('CLOSED');
  });

  it('handles mid-stream connection reset abruptly', () => {
    const sim = new TcpSimulator({ seed: 77, serverStartsInListen: true });
    // Complete handshake
    sim.clientOpen();
    sim.step();
    sim.step();
    sim.step();
    sim.step();
    expect(sim.getSnapshot().client.state).toBe('ESTABLISHED');
    expect(sim.getSnapshot().server.state).toBe('ESTABLISHED');

    sim.abortConnection('client');
    sim.step(); // Client sends RST, enters CLOSED
    expect(sim.getSnapshot().client.state).toBe('CLOSED');
    sim.step(); // Server receives RST, enters CLOSED
    expect(sim.getSnapshot().server.state).toBe('CLOSED');
  });

  it('guarantees deterministic execution and time travel parity (seek(n) == original)', () => {
    const sim1 = new TcpSimulator({ seed: 1234 });
    const sc = SCENARIOS[0]; // normal lifecycle
    sc.setupEvents?.forEach((fn) => fn(sim1));

    const totalSteps = sim1.getHistoryLength();
    expect(totalSteps).toBeGreaterThan(10);

    // Save copy of all snapshots
    const originalSnapshots = [...sim1.getHistory()];

    // Seek backwards step by step
    for (let i = totalSteps - 1; i >= 0; i--) {
      const snap = sim1.seek(i);
      expect(snap.stepIndex).toBe(i);
      expect(snap.client.state).toBe(originalSnapshots[i].client.state);
      expect(snap.server.state).toBe(originalSnapshots[i].server.state);
      expect(snap.virtualTime).toBe(originalSnapshots[i].virtualTime);
    }

    // Step forward 5, step back 5
    sim1.seek(5);
    const snapAt5 = sim1.getSnapshot();
    for (let i = 0; i < 5; i++) {
      sim1.step();
    }
    expect(sim1.getSnapshot().stepIndex).toBe(10);
    for (let i = 0; i < 5; i++) {
      sim1.seek(sim1.getCursor() - 1);
    }
    expect(sim1.getSnapshot().stepIndex).toBe(5);
    expect(sim1.getSnapshot()).toEqual(snapAt5);
  });

  it('validates protocol invariants across every step of all 12 scenarios', () => {
    for (const scenario of SCENARIOS) {
      const sim = new TcpSimulator({
        seed: 4242,
        serverStartsInListen: scenario.id !== 'port_closed',
        clientMss: scenario.initialMss ?? 16,
      });

      scenario.setupEvents?.forEach((fn) => fn(sim));

      const history = sim.getHistory();
      expect(history.length).toBeGreaterThan(1);

      // Verify invariants on every single snapshot in the scenario history
      for (const snapshot of history) {
        expect(() => verifyInvariants(snapshot)).not.toThrow();
      }
    }
  });
});
