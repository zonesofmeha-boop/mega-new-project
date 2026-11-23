import React from 'react';
import { useSimulatorStore } from '../store/useSimulatorStore';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  Activity,
  Send,
  CheckCircle,
  XCircle,
  RotateCcw,
  Clock,
  Layers,
  Database,
} from 'lucide-react';

export const StatsPanel: React.FC = () => {
  const { snapshot } = useSimulatorStore();
  const stats = snapshot.stats;

  const typeData = Object.entries(stats.packetTypeCounts).map(([type, count]) => ({
    type,
    count,
  }));

  const TYPE_COLORS: Record<string, string> = {
    SYN: '#3b82f6',
    SYN_ACK: '#06b6d4',
    ACK: '#10b981',
    DUP_ACK: '#eab308',
    DATA: '#6366f1',
    FIN: '#f97316',
    FIN_ACK: '#f97316',
    RST: '#ef4444',
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-4">
      <div className="pb-2 border-b border-border">
        <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-primary" />
          Metrics &amp; Analytics
        </h3>
        <p className="text-xs text-foreground-muted">
          Real-time packet counters and latency dynamics
        </p>
      </div>

      {/* Metrics Counter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
        <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
          <div className="flex items-center gap-1 text-[10px] text-foreground-muted uppercase">
            <Send className="w-3 h-3 text-primary" /> Sent Packets
          </div>
          <span className="text-base font-bold text-foreground mt-0.5 block">
            {stats.totalPacketsSent}
          </span>
        </div>

        <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
          <div className="flex items-center gap-1 text-[10px] text-foreground-muted uppercase">
            <CheckCircle className="w-3 h-3 text-success" /> Delivered
          </div>
          <span className="text-base font-bold text-success mt-0.5 block">
            {stats.packetsDelivered}
          </span>
        </div>

        <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
          <div className="flex items-center gap-1 text-[10px] text-foreground-muted uppercase">
            <XCircle className="w-3 h-3 text-danger" /> Dropped / Loss
          </div>
          <span className="text-base font-bold text-danger mt-0.5 block">
            {stats.packetsDropped}
          </span>
        </div>

        <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
          <div className="flex items-center gap-1 text-[10px] text-foreground-muted uppercase">
            <RotateCcw className="w-3 h-3 text-warning" /> Retransmissions
          </div>
          <span className="text-base font-bold text-warning mt-0.5 block">
            {stats.retransmissions}
          </span>
        </div>

        <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
          <div className="flex items-center gap-1 text-[10px] text-foreground-muted uppercase">
            <Layers className="w-3 h-3 text-amber-500" /> Dup ACKs
          </div>
          <span className="text-base font-bold text-foreground mt-0.5 block">
            {stats.dupAcks}
          </span>
        </div>

        <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
          <div className="flex items-center gap-1 text-[10px] text-foreground-muted uppercase">
            <Database className="w-3 h-3 text-accent" /> Stream Bytes
          </div>
          <span className="text-base font-bold text-foreground mt-0.5 block">
            {stats.bytesTransferred} B
          </span>
        </div>

        <div className="bg-surface-elevated p-2.5 rounded-lg border border-border col-span-2">
          <div className="flex items-center gap-1 text-[10px] text-foreground-muted uppercase">
            <Clock className="w-3 h-3 text-info" /> Smoothed RTT / Avg
          </div>
          <span className="text-base font-bold text-info mt-0.5 block">
            {stats.currentRtt} ms{' '}
            <span className="text-xs font-normal text-foreground-muted">
              (Avg: {stats.averageRtt} ms)
            </span>
          </span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        {/* Packet Types Distribution Chart */}
        <div className="bg-surface-elevated p-3 rounded-lg border border-border">
          <span className="text-xs font-semibold text-foreground-muted block mb-2 font-sans">
            Transmitted Packet Types
          </span>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis dataKey="type" tick={{ fontSize: 9 }} interval={0} stroke="#64748b" />
                <YAxis tick={{ fontSize: 9 }} stroke="#64748b" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    fontSize: '11px',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {typeData.map((entry) => (
                    <Cell
                      key={`cell-${entry.type}`}
                      fill={TYPE_COLORS[entry.type] || '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RTT Latency Timeline */}
        <div className="bg-surface-elevated p-3 rounded-lg border border-border">
          <span className="text-xs font-semibold text-foreground-muted block mb-2 font-sans">
            RTT Sample Dynamics (ms)
          </span>
          <div className="h-36">
            {stats.rttHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={stats.rttHistory}
                  margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                >
                  <XAxis dataKey="step" tick={{ fontSize: 9 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 9 }} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      fontSize: '11px',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rtt"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-foreground-muted/60 italic">
                Awaiting RTT samples from round-trip ACKs
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
