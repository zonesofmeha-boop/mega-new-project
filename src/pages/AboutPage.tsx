import React from 'react';
import {
  Cpu,
  Layers,
  ShieldCheck,
  CheckCircle2,
  BookOpen,
  GitBranch,
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Header */}
      <div className="pb-6 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          About TCP Simulator &amp; RFC 793 State Visualizer
        </h1>
        <p className="text-sm text-foreground-muted mt-1">
          A high-fidelity, deterministic discrete-event simulator and interactive visualizer for the Transmission Control Protocol.
        </p>
      </div>

      {/* Architecture Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-lg bg-primary-muted text-primary flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-foreground">Pure Engine Isolation</h3>
          <p className="text-xs text-foreground-muted leading-relaxed">
            <code>src/engine/</code> is 100% pure TypeScript with zero React or UI imports. It can run in Node.js, CLI harnesses, and headless test suites.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-foreground">Discrete-Event Virtual Clock</h3>
          <p className="text-xs text-foreground-muted leading-relaxed">
            No <code>setTimeout</code> in the engine core. A priority queue tracks virtual millisecond ticks, guaranteeing reproducible stepping, pause, resume, and time-travel scrubbing.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-lg bg-success-muted text-success flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-foreground">Table-Driven FSM</h3>
          <p className="text-xs text-foreground-muted leading-relaxed">
            RFC 793 transitions are encoded in an immutable table. The transition function never throws and invalid transitions are logged while leaving state intact.
          </p>
        </div>
      </div>

      {/* Deep Dive Sections */}
      <div className="space-y-6 text-sm text-foreground-muted leading-relaxed">
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            RFC 793 Compliance &amp; Protocol Rules
          </h2>
          <p>
            The simulator accurately implements the core mechanics defined in the Transmission Control Protocol Specification (RFC 793) and subsequent standards (RFC 5681 for Fast Retransmit, RFC 6298 for RTO estimation):
          </p>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Sequence &amp; Acknowledgment Logic:</strong> Both SYN and FIN flags consume exactly 1 sequence number. Data consumes bytes equal to payload length. ACKs are cumulative.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Segmentation &amp; In-Order Reassembly:</strong> Large streams are split into Maximum Segment Size (MSS) units. Out-of-order packets are buffered in the receiver queue, eliciting duplicate ACKs until holes are filled.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Jacobson/Karels RTO Estimation &amp; Karn’s Algorithm:</strong> Retransmission Timeout (RTO) doubles on retransmissions (exponential backoff: 200ms &rarr; 400ms &rarr; 800ms) up to maxRetransmits before aborting.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>RFC 5681 Fast Retransmit:</strong> Arrival of 3 duplicate ACKs triggers immediate retransmission of the lost sequence without awaiting RTO timer expiration.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>2MSL TIME_WAIT Interval:</strong> Active close socket remains in TIME_WAIT for 2 Maximum Segment Lifetimes to safely absorb delayed duplicate packets.
              </span>
            </li>
          </ul>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-accent" />
            Verification &amp; Invariants
          </h2>
          <p>
            The engine is continuously verified via an automated Vitest test suite. After every single discrete step across all 12 pre-configured scenarios, four core protocol invariants are strictly asserted:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono pt-2">
            <div className="bg-surface-elevated p-3 rounded-lg border border-border">
              <span className="font-bold text-foreground block mb-1">1. Send Sequence Order</span>
              <code>SND.UNA &le; SND.NXT</code> (evaluated with 32-bit wrap awareness).
            </div>
            <div className="bg-surface-elevated p-3 rounded-lg border border-border">
              <span className="font-bold text-foreground block mb-1">2. FSM State Validity</span>
              Current state must strictly reside in the 11 defined RFC 793 states.
            </div>
            <div className="bg-surface-elevated p-3 rounded-lg border border-border">
              <span className="font-bold text-foreground block mb-1">3. Causal Transit Ordering</span>
              <code>deliverAtTime &ge; sentAtTime</code> for every packet.
            </div>
            <div className="bg-surface-elevated p-3 rounded-lg border border-border">
              <span className="font-bold text-foreground block mb-1">4. Conservation of Packets</span>
              Total sent = Delivered + Dropped + Corrupted + InFlight.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
