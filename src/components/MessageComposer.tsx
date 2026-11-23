import React from 'react';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { segmentMessage } from '../engine/packet';
import { Send, Layers } from 'lucide-react';

export const MessageComposer: React.FC = () => {
  const {
    customMessage,
    setCustomMessage,
    mss,
    setMss,
    sendData,
    snapshot,
  } = useSimulatorStore();

  const isEstablished =
    snapshot.client.state === 'ESTABLISHED' && snapshot.server.state === 'ESTABLISHED';

  // Preview segmentation in real time
  const previewSegments = segmentMessage(
    customMessage,
    mss,
    snapshot.client.sndNxt
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEstablished || !customMessage) return;
    sendData(customMessage, 'client');
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm font-sans">
      <div className="pb-3 border-b border-border mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
            <Send className="w-4 h-4 text-primary" />
            Message Composer &amp; MSS Segmentation
          </h3>
          <p className="text-xs text-foreground-muted">
            Inspect segmentation across discrete Maximum Segment Sizes
          </p>
        </div>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
            isEstablished
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
          }`}
        >
          {isEstablished ? 'READY TO SEND' : 'REQUIRES ESTABLISHED STATE'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Input row: Message & MSS */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <label className="text-[11px] font-medium text-foreground-muted block mb-1">
              Payload String ({customMessage.length} bytes)
            </label>
            <input
              type="text"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Enter message to transmit..."
              className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
          </div>

          <div className="w-full sm:w-36">
            <label className="text-[11px] font-medium text-foreground-muted block mb-1">
              MSS (Bytes)
            </label>
            <input
              type="number"
              min={1}
              max={128}
              value={mss}
              onChange={(e) => setMss(parseInt(e.target.value, 10) || 16)}
              className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={!isEstablished || customMessage.length === 0}
              className="w-full sm:w-auto px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              Send Stream
            </button>
          </div>
        </div>

        {/* Live Segmentation Preview */}
        <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
          <div className="flex items-center justify-between text-[11px] text-foreground-muted mb-1.5 font-mono">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-primary" /> Segment Breakdown ({previewSegments.length} packets)
            </span>
            <span>Total: {customMessage.length}B</span>
          </div>

          <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
            {previewSegments.map((seg, idx) => (
              <div
                key={idx}
                className="px-2 py-1 rounded bg-background border border-border flex items-center gap-1 text-foreground"
              >
                <span className="text-primary font-bold">#{idx + 1}</span>
                <span className="text-foreground-muted">SEQ:{seg.seq}</span>
                <span className="text-accent font-semibold">&quot;{seg.data}&quot;</span>
                <span className="text-foreground-muted">({seg.length}B)</span>
              </div>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
};
