import React from 'react';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { FailureType } from '../engine/types';
import { FAILURE_DEFINITIONS } from '../engine/failures';
import {
  AlertTriangle,
  XCircle,
  Clock,
  Copy,
  ShieldAlert,
  ServerOff,
  Lock,
  ZapOff,
  Shuffle,
  Trash2,
} from 'lucide-react';

export const FailurePanel: React.FC = () => {
  const { injectFailure, clearFailures, snapshot } = useSimulatorStore();

  const failureButtons: Array<{
    type: FailureType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }> = [
    { type: 'packet_loss', label: 'Drop Packet', icon: XCircle, color: 'text-red-400 hover:bg-red-500/10 border-red-500/30' },
    { type: 'packet_delay', label: 'Delay (+150ms)', icon: Clock, color: 'text-amber-400 hover:bg-amber-500/10 border-amber-500/30' },
    { type: 'packet_duplicate', label: 'Duplicate (2x)', icon: Copy, color: 'text-purple-400 hover:bg-purple-500/10 border-purple-500/30' },
    { type: 'packet_corrupt', label: 'Corrupt Checksum', icon: AlertTriangle, color: 'text-rose-400 hover:bg-rose-500/10 border-rose-500/30' },
    { type: 'missing_ack', label: 'Drop Return ACK', icon: ShieldAlert, color: 'text-orange-400 hover:bg-orange-500/10 border-orange-500/30' },
    { type: 'server_timeout', label: 'Server Timeout', icon: ServerOff, color: 'text-zinc-400 hover:bg-zinc-500/10 border-zinc-500/30' },
    { type: 'port_closed', label: 'Port Closed (RST)', icon: Lock, color: 'text-red-500 hover:bg-red-600/10 border-red-600/30' },
    { type: 'mid_connection_reset', label: 'Inject Mid-RST', icon: ZapOff, color: 'text-amber-500 hover:bg-amber-600/10 border-amber-600/30' },
    { type: 'packet_reorder', label: 'Reorder Segments', icon: Shuffle, color: 'text-cyan-400 hover:bg-cyan-500/10 border-cyan-500/30' },
  ];

  const activeFailureType = snapshot.activeFailure?.type;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
        <div>
          <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Network Failure Injection
          </h3>
          <p className="text-xs text-foreground-muted">
            Trigger simulated packet errors on subsequent transmissions
          </p>
        </div>

        <button
          onClick={clearFailures}
          className="text-xs text-foreground-muted hover:text-foreground flex items-center gap-1 px-2 py-1 rounded bg-surface-elevated border border-border hover:bg-border transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear All
        </button>
      </div>

      {/* Grid of Failure Trigger Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {failureButtons.map((item) => {
          const Icon = item.icon;
          const isActive = activeFailureType === item.type;
          const def = FAILURE_DEFINITIONS[item.type];

          return (
            <button
              key={item.type}
              onClick={() => injectFailure(item.type, { remainingUses: 1 })}
              title={def?.explanation}
              className={`p-2.5 rounded-lg border text-left text-xs font-medium flex items-center gap-2 transition-all active:scale-95 ${
                isActive
                  ? 'bg-primary/20 border-primary ring-2 ring-primary/40 text-primary font-bold'
                  : `bg-surface-elevated ${item.color}`
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <span className="block truncate">{item.label}</span>
                <span className="text-[10px] opacity-70 block font-normal">Next packet</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
