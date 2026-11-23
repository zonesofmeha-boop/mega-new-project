import React from 'react';
import { TcpPacket } from '../engine/types';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeft,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  inFlightPackets: TcpPacket[];
}

export const NetworkTransit: React.FC<Props> = ({ inFlightPackets }) => {
  const { selectPacket } = useSimulatorStore();

  const getPacketColor = (type: string, isRtx?: boolean, isDropped?: boolean) => {
    if (isDropped) return 'bg-red-500/20 text-red-400 border-red-500/50';
    if (isRtx) return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
    switch (type) {
      case 'SYN':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'SYN_ACK':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50';
      case 'ACK':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 'DUP_ACK':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'DATA':
        return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50';
      case 'FIN':
      case 'FIN_ACK':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'RST':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/50';
      default:
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50';
    }
  };

  return (
    <div className="relative py-4 px-6 bg-surface-elevated/40 border border-border-subtle rounded-xl my-4 overflow-hidden">
      {/* Network Channel Wire */}
      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2 z-0" />

      {/* Direction indicators */}
      <div className="flex items-center justify-between text-[11px] font-mono text-foreground-muted mb-2 relative z-10">
        <span className="flex items-center gap-1">
          Client <ArrowRight className="w-3 h-3 text-primary animate-pulse" />
        </span>
        <span className="px-2 py-0.5 rounded bg-surface border border-border text-[10px]">
          Network Channel (Virtual Delay: ~50ms)
        </span>
        <span className="flex items-center gap-1">
          <ArrowLeft className="w-3 h-3 text-accent animate-pulse" /> Server
        </span>
      </div>

      {/* Animated Packets In-Flight */}
      <div className="min-h-16 flex items-center justify-center relative z-10">
        <AnimatePresence>
          {inFlightPackets.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-foreground-muted/60 font-mono italic"
            >
              Channel idle (no packets in transit)
            </motion.div>
          ) : (
            <div className="flex flex-wrap gap-2 justify-center w-full">
              {inFlightPackets.map((pkt) => {
                const isClientToServer = pkt.source === 'client';
                const styleClasses = getPacketColor(pkt.type, pkt.isRetransmission, pkt.isDropped);

                return (
                  <motion.div
                    key={pkt.id}
                    initial={{
                      x: isClientToServer ? -80 : 80,
                      opacity: 0,
                      scale: 0.8,
                    }}
                    animate={{ x: 0, opacity: 1, scale: 1 }}
                    exit={{
                      x: isClientToServer ? 80 : -80,
                      opacity: 0,
                      scale: 0.8,
                    }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    onClick={() => selectPacket(pkt)}
                    className={`cursor-pointer px-3 py-1.5 rounded-lg border text-xs font-mono font-medium shadow-md flex items-center gap-2 hover:scale-105 transition-transform ${styleClasses}`}
                  >
                    {isClientToServer ? (
                      <ArrowRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowLeft className="w-3.5 h-3.5" />
                    )}

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold">{pkt.type}</span>
                        {pkt.isRetransmission && (
                          <span className="px-1 py-0.2 rounded bg-amber-500/30 text-amber-300 text-[9px] font-bold">
                            RTX
                          </span>
                        )}
                        {pkt.isDropped && (
                          <span className="px-1 py-0.2 rounded bg-red-500/30 text-red-300 text-[9px] font-bold flex items-center gap-0.5">
                            <XCircle className="w-2.5 h-2.5" /> DROPPED
                          </span>
                        )}
                        {pkt.isCorrupted && (
                          <span className="px-1 py-0.2 rounded bg-rose-500/30 text-rose-300 text-[9px] font-bold flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> BAD CHK
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] opacity-80">
                        SEQ:{pkt.seqNum} {pkt.flags.ack && `ACK:${pkt.ackNum}`}{' '}
                        {pkt.length > 0 && `LEN:${pkt.length}B`}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
