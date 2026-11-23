import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  NodeProps,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { getFsmGraphData } from '../engine/fsm';
import { TcpState } from '../engine/types';
import { Network, Laptop, Server } from 'lucide-react';

const STATE_ACCENTS: Record<TcpState, { border: string; glow: string; text: string }> = {
  CLOSED: { border: 'border-zinc-500', glow: 'shadow-zinc-500/30', text: 'text-zinc-400' },
  LISTEN: { border: 'border-purple-500', glow: 'shadow-purple-500/50', text: 'text-purple-400' },
  SYN_SENT: { border: 'border-blue-500', glow: 'shadow-blue-500/50', text: 'text-blue-400' },
  SYN_RECEIVED: { border: 'border-cyan-500', glow: 'shadow-cyan-500/50', text: 'text-cyan-400' },
  ESTABLISHED: { border: 'border-emerald-500', glow: 'shadow-emerald-500/60', text: 'text-emerald-400' },
  FIN_WAIT_1: { border: 'border-amber-500', glow: 'shadow-amber-500/50', text: 'text-amber-400' },
  FIN_WAIT_2: { border: 'border-amber-500', glow: 'shadow-amber-500/50', text: 'text-amber-400' },
  CLOSE_WAIT: { border: 'border-orange-500', glow: 'shadow-orange-500/50', text: 'text-orange-400' },
  CLOSING: { border: 'border-rose-500', glow: 'shadow-rose-500/50', text: 'text-rose-400' },
  LAST_ACK: { border: 'border-rose-500', glow: 'shadow-rose-500/50', text: 'text-rose-400' },
  TIME_WAIT: { border: 'border-yellow-500', glow: 'shadow-yellow-500/50', text: 'text-yellow-400' },
};

// Custom Node Component for TCP States
const TcpStateNode: React.FC<NodeProps> = ({ data, id }) => {
  const state = id as TcpState;
  const isActive = Boolean(data.isActive);
  const styling = STATE_ACCENTS[state] || STATE_ACCENTS.CLOSED;

  return (
    <div
      className={`relative px-3.5 py-2 rounded-xl bg-surface border-2 text-xs font-mono font-bold transition-all ${
        isActive
          ? `${styling.border} ${styling.glow} shadow-lg ring-2 ring-primary scale-110 z-20`
          : 'border-border/80 text-foreground-muted hover:border-foreground-muted/50'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />

      <div className="flex items-center gap-1.5">
        {isActive && (
          <span className="w-2 h-2 rounded-full bg-current animate-ping" />
        )}
        <span className={isActive ? styling.text : 'text-foreground'}>{data.label as string}</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-accent !w-2 !h-2" />
    </div>
  );
};

const nodeTypes = {
  tcpStateNode: TcpStateNode,
};

export const StateDiagram: React.FC = () => {
  const { snapshot, stateMachineTarget, setStateMachineTarget } = useSimulatorStore();

  const activeTcb = stateMachineTarget === 'client' ? snapshot.client : snapshot.server;
  const activeState = activeTcb.state;

  // Determine if the last active transition was on this endpoint
  const lastEdgeId =
    snapshot.lastActiveTransition?.endpoint === stateMachineTarget
      ? snapshot.lastActiveTransition.edgeId
      : undefined;

  const { nodes, edges } = useMemo(() => {
    const raw = getFsmGraphData(activeState, lastEdgeId);
    return {
      nodes: raw.nodes as unknown as Node[],
      edges: raw.edges as unknown as Edge[],
    };
  }, [activeState, lastEdgeId]);

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col h-full shadow-sm">
      {/* Header and Endpoint Switcher */}
      <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
        <div>
          <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
            <Network className="w-4 h-4 text-primary" />
            RFC 793 State Machine FSM
          </h3>
          <p className="text-xs text-foreground-muted">
            All 11 states driven by pure transition table
          </p>
        </div>

        {/* Toggle Target: Client vs Server */}
        <div className="flex items-center bg-surface-elevated p-1 rounded-lg border border-border">
          <button
            onClick={() => setStateMachineTarget('client')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition-colors ${
              stateMachineTarget === 'client'
                ? 'bg-primary text-white shadow-sm'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            Client
          </button>
          <button
            onClick={() => setStateMachineTarget('server')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition-colors ${
              stateMachineTarget === 'server'
                ? 'bg-accent text-white shadow-sm'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Server
          </button>
        </div>
      </div>

      {/* Active State Callout */}
      <div className="mb-2 p-2 rounded-lg bg-surface-elevated border border-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-foreground-muted">Viewing {stateMachineTarget.toUpperCase()} state:</span>
          <span className="font-bold font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            {activeState}
          </span>
        </div>
        {snapshot.lastActiveTransition && (
          <span className="text-[11px] text-foreground-muted hidden sm:inline">
            Traversed: {snapshot.lastActiveTransition.fromState} &rarr; {snapshot.lastActiveTransition.toState} on {snapshot.lastActiveTransition.event}
          </span>
        )}
      </div>

      {/* React Flow Viewport */}
      <div className="flex-1 min-h-[380px] max-h-[500px] rounded-lg border border-border overflow-hidden bg-background/50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.5}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
        >
          <Background color="currentColor" className="opacity-5" gap={20} size={1} />
          <Controls showInteractive={false} className="!bg-surface !border-border !fill-foreground" />
        </ReactFlow>
      </div>
    </div>
  );
};
