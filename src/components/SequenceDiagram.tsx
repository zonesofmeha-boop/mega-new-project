import React, { useRef, useEffect } from 'react';
import { TcpPacket } from '../engine/types';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { ArrowRight, ArrowLeft, XCircle, AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  packetHistory: TcpPacket[];
}

export const SequenceDiagram: React.FC<Props> = ({ packetHistory }) => {
  const { selectPacket, selectedPacket } = useSimulatorStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new packets appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [packetHistory.length]);

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col h-full shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
        <div>
          <h3 className="font-bold text-sm tracking-tight">Sequence Ladder Diagram</h3>
          <p className="text-xs text-foreground-muted">
            RFC 793 Message Exchange (Click packet to inspect)
          </p>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-elevated border border-border text-foreground-muted">
          {packetHistory.length} total transmissions
        </span>
      </div>

      {/* Lifeline Headers */}
      <div className="grid grid-cols-2 text-center text-xs font-mono font-bold py-2 bg-surface-elevated rounded-lg border border-border mb-2">
        <div className="text-primary flex items-center justify-center gap-1.5 border-r border-border">
          <span className="w-2 h-2 rounded-full bg-primary" /> Client (52140)
        </div>
        <div className="text-accent flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent" /> Server (80)
        </div>
      </div>

      {/* Ladder area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-64 max-h-[460px] relative px-4 py-2 space-y-3 font-mono text-xs"
      >
        {/* Lifeline vertical tracks */}
        <div className="absolute top-0 bottom-0 left-[25%] w-px bg-border/60 pointer-events-none" />
        <div className="absolute top-0 bottom-0 right-[25%] w-px bg-border/60 pointer-events-none" />

        {packetHistory.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-foreground-muted/60 italic">
            No packets exchanged yet. Step forward or click Play.
          </div>
        ) : (
          packetHistory.map((pkt, idx) => {
            const isClientToServer = pkt.source === 'client';
            const isSelected = selectedPacket?.id === pkt.id;

            return (
              <div
                key={pkt.id}
                onClick={() => selectPacket(pkt)}
                className={`group relative py-1.5 px-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary/20 border-primary ring-2 ring-primary/40'
                    : 'bg-surface-elevated/80 hover:bg-surface-elevated border-border'
                }`}
              >
                {/* Slanted / Directional Arrow Header */}
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-[10px] text-foreground-muted">
                    #{idx + 1} @ {pkt.sentAtTime}ms
                  </span>
                  <div className="flex items-center gap-1 font-bold">
                    {isClientToServer ? (
                      <>
                        <span className="text-primary">Client</span>
                        <ArrowRight className="w-3.5 h-3.5 text-primary" />
                        <span className="text-foreground-muted">Server</span>
                      </>
                    ) : (
                      <>
                        <span className="text-foreground-muted">Client</span>
                        <ArrowLeft className="w-3.5 h-3.5 text-accent" />
                        <span className="text-accent">Server</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Packet Label & Metadata */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        pkt.type === 'SYN'
                          ? 'bg-blue-500/20 text-blue-400'
                          : pkt.type === 'SYN_ACK'
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : pkt.type === 'ACK'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : pkt.type === 'DATA'
                          ? 'bg-indigo-500/20 text-indigo-400'
                          : pkt.type === 'FIN' || pkt.type === 'FIN_ACK'
                          ? 'bg-orange-500/20 text-orange-400'
                          : pkt.type === 'RST'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {pkt.type}
                    </span>

                    <span className="text-foreground font-semibold">
                      SEQ={pkt.seqNum}
                    </span>

                    {pkt.flags.ack && (
                      <span className="text-foreground-muted">ACK={pkt.ackNum}</span>
                    )}

                    {pkt.length > 0 && (
                      <span className="text-foreground-muted">LEN={pkt.length}B</span>
                    )}
                  </div>

                  {/* Badges: RTX / Dropped / Corrupt */}
                  <div className="flex items-center gap-1">
                    {pkt.isRetransmission && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold flex items-center gap-0.5">
                        <RotateCcw className="w-2.5 h-2.5" /> RTX
                      </span>
                    )}
                    {pkt.isDropped && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-bold flex items-center gap-0.5">
                        <XCircle className="w-2.5 h-2.5" /> DROPPED
                      </span>
                    )}
                    {pkt.isCorrupted && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-bold flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> CORRUPT
                      </span>
                    )}
                  </div>
                </div>

                {/* Optional payload snippet */}
                {pkt.payload && (
                  <div className="mt-1 text-[10px] text-foreground-muted bg-background/50 px-2 py-0.5 rounded border border-border-subtle truncate">
                    Payload: &quot;{pkt.payload}&quot;
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
