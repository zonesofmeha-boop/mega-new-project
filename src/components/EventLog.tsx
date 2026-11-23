import React from 'react';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { LogEntry } from '../engine/types';
import {
  Search,
  CheckCircle,
  AlertTriangle,
  Info,
  XCircle,
  ArrowUpRight,
} from 'lucide-react';

export const EventLog: React.FC = () => {
  const { snapshot, logFilter, setLogFilter, seek } = useSimulatorStore();
  const logs = snapshot.logs;

  // Filter logs based on active criteria
  const filteredLogs = logs.filter((entry) => {
    if (logFilter.level !== 'all' && entry.level !== logFilter.level) {
      return false;
    }
    if (logFilter.endpoint !== 'all' && entry.endpoint !== logFilter.endpoint) {
      return false;
    }
    if (logFilter.category !== 'all' && entry.category !== logFilter.category) {
      return false;
    }
    if (logFilter.search && !entry.message.toLowerCase().includes(logFilter.search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="w-3.5 h-3.5 text-success" />;
      case 'warn':
        return <AlertTriangle className="w-3.5 h-3.5 text-warning" />;
      case 'error':
        return <XCircle className="w-3.5 h-3.5 text-danger" />;
      default:
        return <Info className="w-3.5 h-3.5 text-primary" />;
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col h-full">
      {/* Header & Filter Controls */}
      <div className="pb-3 border-b border-border mb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
              Protocol Event Log
              <span className="text-xs font-normal text-foreground-muted font-mono">
                ({filteredLogs.length}/{logs.length})
              </span>
            </h3>
            <p className="text-xs text-foreground-muted">
              Click any log entry to time-travel &amp; seek to that step
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-40 sm:w-56">
            <Search className="w-3.5 h-3.5 text-foreground-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search events..."
              value={logFilter.search}
              onChange={(e) => setLogFilter({ search: e.target.value })}
              className="w-full bg-surface-elevated border border-border text-foreground text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Level Filter */}
          <select
            value={logFilter.level}
            onChange={(e) => setLogFilter({ level: e.target.value })}
            className="bg-surface-elevated border border-border rounded-md px-2 py-1 text-foreground text-[11px]"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </select>

          {/* Endpoint Filter */}
          <select
            value={logFilter.endpoint}
            onChange={(e) => setLogFilter({ endpoint: e.target.value })}
            className="bg-surface-elevated border border-border rounded-md px-2 py-1 text-foreground text-[11px]"
          >
            <option value="all">All Endpoints</option>
            <option value="client">Client</option>
            <option value="server">Server</option>
            <option value="network">Network</option>
          </select>

          {/* Category Filter */}
          <select
            value={logFilter.category}
            onChange={(e) => setLogFilter({ category: e.target.value })}
            className="bg-surface-elevated border border-border rounded-md px-2 py-1 text-foreground text-[11px]"
          >
            <option value="all">All Categories</option>
            <option value="fsm">FSM</option>
            <option value="packet">Packet</option>
            <option value="timer">Timer / RTO</option>
            <option value="buffer">Buffer / Reassembly</option>
            <option value="failure">Failure / Drop</option>
            <option value="app">Application</option>
          </select>
        </div>
      </div>

      {/* Log Entries List */}
      <div className="flex-1 overflow-y-auto max-h-[380px] space-y-1.5 pr-1 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-foreground-muted/60 italic">
            No log entries match the current filter criteria.
          </div>
        ) : (
          filteredLogs.map((entry) => {
            const isCurrentStep = entry.stepIndex === snapshot.stepIndex;

            return (
              <div
                key={entry.id}
                onClick={() => seek(entry.stepIndex)}
                className={`group flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${
                  isCurrentStep
                    ? 'bg-primary/15 border-primary/40 shadow-sm'
                    : 'bg-surface-elevated/60 hover:bg-surface-elevated border-border-subtle'
                }`}
              >
                {/* Level Icon */}
                <div className="pt-0.5">{getLevelIcon(entry.level)}</div>

                {/* Entry content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted mb-0.5">
                    <span className="font-bold text-foreground">Step #{entry.stepIndex}</span>
                    <span>&bull;</span>
                    <span>{entry.time}ms</span>
                    {entry.endpoint && (
                      <>
                        <span>&bull;</span>
                        <span className="uppercase font-semibold text-primary/80">
                          {entry.endpoint}
                        </span>
                      </>
                    )}
                    <span>&bull;</span>
                    <span className="uppercase text-[9px] px-1 py-0.2 rounded bg-background border border-border-subtle">
                      {entry.category}
                    </span>
                  </div>
                  <p className="text-foreground text-[11px] leading-relaxed break-words font-sans">
                    {entry.message}
                  </p>
                </div>

                {/* Seek hover indicator */}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-primary flex items-center gap-0.5 pt-0.5">
                  Seek <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
