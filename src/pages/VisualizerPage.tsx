import React from 'react';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { ControlsBar } from '../components/ControlsBar';
import { EndpointCard } from '../components/EndpointCard';
import { NetworkTransit } from '../components/NetworkTransit';
import { SequenceDiagram } from '../components/SequenceDiagram';
import { StateDiagram } from '../components/StateDiagram';
import { PacketInspector } from '../components/PacketInspector';
import { EventLog } from '../components/EventLog';
import { StatsPanel } from '../components/StatsPanel';
import { ExplanationCard } from '../components/ExplanationCard';
import { FailurePanel } from '../components/FailurePanel';
import { MessageComposer } from '../components/MessageComposer';

export const VisualizerPage: React.FC = () => {
  const { snapshot } = useSimulatorStore();

  return (
    <div className="space-y-6 pb-12">
      {/* Playback Controls & Timeline Bar */}
      <ControlsBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Contextual Explanation Card */}
        <ExplanationCard />

        {/* Client & Server Cards with Network Transit in between */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <EndpointCard
            endpoint="client"
            tcb={snapshot.client}
            peerTcb={snapshot.server}
          />
          <EndpointCard
            endpoint="server"
            tcb={snapshot.server}
            peerTcb={snapshot.client}
          />
        </div>

        {/* Animated Network Transit Channel */}
        <NetworkTransit inFlightPackets={snapshot.inFlightPackets} />

        {/* Core Diagrams: Ladder Sequence vs React Flow FSM */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <SequenceDiagram packetHistory={snapshot.packetHistory} />
          <StateDiagram />
        </div>

        {/* Packet Inspector & Event Log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <PacketInspector />
          <EventLog />
        </div>

        {/* Failure Injection & Message Composer */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <FailurePanel />
          <MessageComposer />
        </div>

        {/* Stats & Analytics */}
        <StatsPanel />
      </main>
    </div>
  );
};
