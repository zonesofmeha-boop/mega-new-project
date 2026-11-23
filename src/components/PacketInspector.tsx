import React, { useState } from 'react';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { TcpPacket } from '../engine/types';
import {
  Search,
  Binary,
  Code2,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';

export const PacketInspector: React.FC = () => {
  const { selectedPacket, snapshot } = useSimulatorStore();
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'fields' | 'hex'>('fields');

  // Fallback to the latest packet if none selected
  const packet: TcpPacket | undefined =
    selectedPacket || snapshot.packetHistory[snapshot.packetHistory.length - 1];

  if (!packet) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 shadow-sm h-full flex flex-col font-mono">
        <div className="pb-3 border-b border-border mb-3 font-sans">
          <h3 className="font-bold text-sm tracking-tight">Packet Inspector</h3>
          <p className="text-xs text-foreground-muted">RFC 793 Header Field Breakdown</p>
        </div>
        <div className="flex-1 flex flex-col justify-center items-center text-center py-8">
          <Search className="w-8 h-8 text-foreground-muted mb-2 opacity-50" />
          <h4 className="font-semibold text-sm">No Packet Selected</h4>
          <p className="text-xs text-foreground-muted max-w-xs mt-1">
            Step forward or select any packet from the Sequence Diagram to inspect its 32-bit TCP header and payload.
          </p>
        </div>
      </div>
    );
  }

  const handleCopyHex = () => {
    if (packet.hexDump) {
      navigator.clipboard.writeText(packet.hexDump);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const flagsList = [
    { name: 'URG', active: packet.flags.urg },
    { name: 'ACK', active: packet.flags.ack },
    { name: 'PSH', active: packet.flags.psh },
    { name: 'RST', active: packet.flags.rst },
    { name: 'SYN', active: packet.flags.syn },
    { name: 'FIN', active: packet.flags.fin },
  ];

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col h-full font-mono">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border mb-3 font-sans">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm tracking-tight">Packet Inspector</h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary-muted text-primary border border-primary/20 font-bold">
              {packet.id}
            </span>
          </div>
          <p className="text-xs text-foreground-muted">
            {packet.source.toUpperCase()} &rarr; {packet.destination.toUpperCase()} | Sent @ {packet.sentAtTime}ms
          </p>
        </div>

        {/* View mode toggle (Fields vs Hex) */}
        <div className="flex items-center bg-surface-elevated p-1 rounded-lg border border-border">
          <button
            onClick={() => setViewMode('fields')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition-colors ${
              viewMode === 'fields'
                ? 'bg-primary text-white shadow-sm'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            <Binary className="w-3.5 h-3.5" />
            Fields
          </button>
          <button
            onClick={() => setViewMode('hex')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition-colors ${
              viewMode === 'hex'
                ? 'bg-primary text-white shadow-sm'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Hex Dump
          </button>
        </div>
      </div>

      {viewMode === 'fields' ? (
        <div className="space-y-3 text-xs overflow-y-auto max-h-[380px] pr-1">
          {/* Ports & Sequence 32-bit row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface-elevated p-2 rounded-lg border border-border">
              <span className="text-[10px] text-foreground-muted block uppercase">Source Port (16-bit)</span>
              <span className="font-bold text-foreground text-sm">{packet.srcPort}</span>
            </div>
            <div className="bg-surface-elevated p-2 rounded-lg border border-border">
              <span className="text-[10px] text-foreground-muted block uppercase">Destination Port (16-bit)</span>
              <span className="font-bold text-foreground text-sm">{packet.dstPort}</span>
            </div>
          </div>

          {/* Sequence & Acknowledgment Numbers */}
          <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-foreground-muted uppercase">Sequence Number (32-bit)</span>
              <span className="font-bold text-primary text-sm">{packet.seqNum}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-foreground-muted uppercase">Acknowledgment Number (32-bit)</span>
              <span className="font-bold text-foreground text-sm">
                {packet.flags.ack ? packet.ackNum : '0 (Not Set)'}
              </span>
            </div>
          </div>

          {/* TCP Control Flags */}
          <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
            <span className="text-[10px] text-foreground-muted block uppercase mb-1.5 font-sans font-semibold">
              Control Flags (6-bit RFC 793)
            </span>
            <div className="grid grid-cols-6 gap-1.5 text-center">
              {flagsList.map((f) => (
                <div
                  key={f.name}
                  className={`py-1 rounded border text-[11px] font-bold ${
                    f.active
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'bg-background/40 text-foreground-muted/40 border-border/40'
                  }`}
                >
                  {f.name}
                  <span className="block text-[9px] opacity-75">{f.active ? '1' : '0'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Window, Checksum, Urgent Pointer */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface-elevated p-2 rounded-lg border border-border">
              <span className="text-[10px] text-foreground-muted block uppercase">Window Size</span>
              <span className="font-bold text-foreground">{packet.windowSize}</span>
            </div>
            <div className="bg-surface-elevated p-2 rounded-lg border border-border">
              <span className="text-[10px] text-foreground-muted block uppercase">Checksum</span>
              <div className="flex items-center gap-1 font-bold">
                <span className={packet.isCorrupted ? 'text-danger' : 'text-success'}>
                  0x{packet.checksum.toString(16).padStart(4, '0').toUpperCase()}
                </span>
                {packet.isCorrupted ? (
                  <AlertTriangle className="w-3 h-3 text-danger" />
                ) : (
                  <CheckCircle className="w-3 h-3 text-success" />
                )}
              </div>
            </div>
            <div className="bg-surface-elevated p-2 rounded-lg border border-border">
              <span className="text-[10px] text-foreground-muted block uppercase">Header Len</span>
              <span className="font-bold text-foreground">{packet.dataOffset * 4} bytes</span>
            </div>
          </div>

          {/* Payload Data View */}
          <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
            <div className="flex items-center justify-between text-[10px] text-foreground-muted uppercase mb-1">
              <span>Payload Data</span>
              <span>{packet.length} bytes</span>
            </div>
            <div className="bg-background/80 p-2 rounded border border-border text-foreground font-mono text-[11px] break-all">
              {packet.payload ? (
                `"${packet.payload}"`
              ) : (
                <span className="text-foreground-muted/50 italic">&lt;No application payload&gt;</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Hex Dump View */
        <div className="relative flex-1 bg-surface-elevated rounded-lg border border-border p-3 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-foreground-muted uppercase">Offset (Hex) | Byte Stream | ASCII</span>
            <button
              onClick={handleCopyHex}
              className="px-2 py-0.5 rounded bg-surface border border-border text-foreground-muted hover:text-foreground text-[10px] flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy Hex'}
            </button>
          </div>
          <pre className="text-[11px] text-foreground leading-relaxed overflow-x-auto flex-1 select-all font-mono">
            {packet.hexDump || 'No hex dump available'}
          </pre>
        </div>
      )}
    </div>
  );
};
