import React from 'react';
import { TCB, EndpointId } from '../engine/types';
import { useSimulatorStore } from '../store/useSimulatorStore';
import {
  Server,
  Laptop,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Power,
  ZapOff,
} from 'lucide-react';

interface Props {
  tcb: TCB;
  peerTcb: TCB;
  endpoint: EndpointId;
}

const STATE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CLOSED: { bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/30' },
  LISTEN: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  SYN_SENT: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  SYN_RECEIVED: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  ESTABLISHED: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  FIN_WAIT_1: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  FIN_WAIT_2: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  CLOSE_WAIT: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  CLOSING: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  LAST_ACK: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  TIME_WAIT: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
};

export const EndpointCard: React.FC<Props> = ({ tcb, endpoint }) => {
  const { clientOpen, sendData, closeConnection, abortConnection } = useSimulatorStore();
  const isClient = endpoint === 'client';
  const Icon = isClient ? Laptop : Server;
  const stateTheme = STATE_COLORS[tcb.state] || STATE_COLORS.CLOSED;

  // Active action states
  const canSendSyn = isClient && tcb.state === 'CLOSED';
  const canSendData = tcb.state === 'ESTABLISHED';
  const canClose = tcb.state === 'ESTABLISHED' || tcb.state === 'CLOSE_WAIT';
  const canAbort = tcb.state !== 'CLOSED';

  return (
    <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-sm flex flex-col justify-between transition-all">
      <div>
        {/* Header: Title, IP:Port and State Badge */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isClient
                  ? 'bg-primary-muted text-primary border border-primary/20'
                  : 'bg-accent/15 text-accent border border-accent/20'
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base capitalize flex items-center gap-1.5">
                {endpoint}
                <span className="text-xs font-normal text-foreground-muted font-mono">
                  ({tcb.ip}:{tcb.port})
                </span>
              </h3>
              <p className="text-xs text-foreground-muted">
                MSS: <span className="font-mono font-medium text-foreground">{tcb.mss}B</span> | Window:{' '}
                <span className="font-mono font-medium text-foreground">{tcb.rcvWnd}</span>
              </p>
            </div>
          </div>

          {/* State Badge */}
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider border uppercase flex items-center gap-1.5 ${stateTheme.bg} ${stateTheme.text} ${stateTheme.border}`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            {tcb.state}
          </div>
        </div>

        {/* TCB Sequence Counters Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4 font-mono text-xs">
          <div className="bg-surface-elevated p-2 rounded-lg border border-border">
            <span className="text-[10px] text-foreground-muted block uppercase">SND.UNA</span>
            <span className="font-bold text-foreground text-sm">{tcb.sndUna}</span>
          </div>
          <div className="bg-surface-elevated p-2 rounded-lg border border-border">
            <span className="text-[10px] text-foreground-muted block uppercase">SND.NXT</span>
            <span className="font-bold text-foreground text-sm">{tcb.sndNxt}</span>
          </div>
          <div className="bg-surface-elevated p-2 rounded-lg border border-border">
            <span className="text-[10px] text-foreground-muted block uppercase">RCV.NXT</span>
            <span className="font-bold text-foreground text-sm">{tcb.rcvNxt}</span>
          </div>
          <div className="bg-surface-elevated p-2 rounded-lg border border-border col-span-3 sm:col-span-1">
            <span className="text-[10px] text-foreground-muted block uppercase">RTO TIMER</span>
            <span className="font-bold text-amber-500 text-sm">
              {tcb.timerRetransmit ? `${tcb.rto}ms` : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Buffer & Stream status */}
        <div className="space-y-2 mb-4 text-xs font-mono">
          <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
            <div className="flex items-center justify-between text-foreground-muted mb-1 text-[11px]">
              <span className="flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-primary" /> Send Queue (Unacked)
              </span>
              <span>{tcb.sendQueue.length} segments</span>
            </div>
            {tcb.sendQueue.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {tcb.sendQueue.map((seg, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 text-[10px]"
                  >
                    SEQ:{seg.seq} ({seg.length}B) {seg.retries > 0 && `RTX#${seg.retries}`}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-foreground-muted/60 text-[11px] italic">Queue empty</span>
            )}
          </div>

          <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
            <div className="flex items-center justify-between text-foreground-muted mb-1 text-[11px]">
              <span className="flex items-center gap-1">
                <ArrowDownLeft className="w-3 h-3 text-success" /> Delivered Stream
              </span>
              <span>{tcb.deliveredData.length} bytes</span>
            </div>
            <div className="bg-background/80 p-1.5 rounded border border-border truncate text-foreground">
              {tcb.deliveredData || <span className="text-foreground-muted/60 italic">No stream payload received yet</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Action triggers */}
      <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
        {isClient && canSendSyn && (
          <button
            onClick={() => clientOpen()}
            className="flex-1 py-1.5 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Connect (SYN)
          </button>
        )}

        {canSendData && (
          <button
            onClick={() => sendData(undefined, endpoint)}
            className="flex-1 py-1.5 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Send Data
          </button>
        )}

        {canClose && (
          <button
            onClick={() => closeConnection(endpoint)}
            className="py-1.5 px-3 rounded-lg bg-warning/15 hover:bg-warning/25 text-warning border border-warning/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Power className="w-3.5 h-3.5" />
            Close (FIN)
          </button>
        )}

        {canAbort && (
          <button
            onClick={() => abortConnection(endpoint)}
            className="py-1.5 px-3 rounded-lg bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <ZapOff className="w-3.5 h-3.5" />
            Abort (RST)
          </button>
        )}
      </div>
    </div>
  );
};
