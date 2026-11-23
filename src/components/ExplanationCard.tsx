import React from 'react';
import { useSimulatorStore } from '../store/useSimulatorStore';
import {
  Lightbulb,
  AlertCircle,
  ShieldCheck,
  Info,
} from 'lucide-react';

export const ExplanationCard: React.FC = () => {
  const { snapshot } = useSimulatorStore();

  const getStepExplanation = () => {
    const { client, server, lastActiveTransition, lastEventDescription } = snapshot;

    if (lastActiveTransition) {
      return {
        title: `FSM Transition: ${lastActiveTransition.fromState} \u2192 ${lastActiveTransition.toState}`,
        body: `The ${lastActiveTransition.endpoint.toUpperCase()} transitioned from ${
          lastActiveTransition.fromState
        } to ${lastActiveTransition.toState} triggered by event ${lastActiveTransition.event}.`,
        rfcNote:
          'Under RFC 793, TCP transitions are strictly table-driven to guarantee deterministic state alignment across asynchronous packet networks.',
      };
    }

    if (client.state === 'CLOSED' && server.state === 'LISTEN') {
      return {
        title: 'Initial Ready State',
        body: 'Server is in LISTEN state on port 80 waiting for incoming connection attempts. Client socket is CLOSED and ready to perform an Active Open.',
        rfcNote:
          'Section 3.1: A passive OPEN request causes the creation of a Transmission Control Block (TCB) in the LISTEN state.',
      };
    }

    if (client.state === 'ESTABLISHED' && server.state === 'ESTABLISHED') {
      return {
        title: 'Connection Synchronized (ESTABLISHED)',
        body: 'Both endpoints have synchronized their Initial Sequence Numbers (ISNs) and acknowledged peer capabilities. Bi-directional full-duplex stream transmission is now active.',
        rfcNote:
          'Section 3.4: In ESTABLISHED state, data may be transmitted in both directions. All segments carry valid ACK numbers.',
      };
    }

    if (client.state === 'TIME_WAIT' || server.state === 'TIME_WAIT') {
      return {
        title: '2MSL TIME_WAIT Protection',
        body: 'The active closing endpoint has entered TIME_WAIT. It must wait for 2 Maximum Segment Lifetimes (2MSL) before deleting its TCB.',
        rfcNote:
          'Section 3.5: TIME_WAIT prevents delayed duplicate packets from a previous incarnation from corrupting a new connection on the same port tuple.',
      };
    }

    return {
      title: 'Simulation Step',
      body: lastEventDescription || 'Executing discrete event simulation cycle.',
      rfcNote: 'Deterministic virtual clock progression.',
    };
  };

  const explanation = getStepExplanation();

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
      {/* Active Step Protocol Card */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary-muted text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Lightbulb className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-sm text-foreground">{explanation.title}</h4>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-surface-elevated text-foreground-muted border border-border">
              RFC 793
            </span>
          </div>
          <p className="text-xs text-foreground-muted leading-relaxed mb-2 font-sans">
            {explanation.body}
          </p>
          <div className="bg-surface-elevated p-2 rounded-lg border border-border text-[11px] text-foreground-muted flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <span>{explanation.rfcNote}</span>
          </div>
        </div>
      </div>

      {/* Active Network Failure Card (if injected) */}
      {snapshot.activeFailure && (
        <div className="p-3 rounded-lg bg-danger-muted border border-danger/30 text-xs mt-3">
          <div className="flex items-center gap-2 mb-1 font-bold text-danger">
            <AlertCircle className="w-4 h-4" />
            <span>Active Failure Cue: {snapshot.activeFailure.cue}</span>
          </div>
          <p className="text-foreground text-[11px] leading-relaxed mb-1.5 font-sans">
            {snapshot.activeFailure.explanation}
          </p>
          <div className="text-[10px] text-foreground-muted flex items-center gap-1 font-mono">
            <ShieldCheck className="w-3 h-3 text-success" />
            <span>Recovery: Retransmission timer (RTO) / Cumulative ACK / Fast Retransmit</span>
          </div>
        </div>
      )}
    </div>
  );
};
