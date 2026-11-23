import { describe, it, expect } from 'vitest';
import {
  transition,
  TCP_FSM_TRANSITIONS,
  getFsmGraphData,
} from '../fsm';
import { ALL_TCP_STATES, TcpEvent } from '../types';

describe('TCP Finite State Machine (RFC 793)', () => {
  it('covers all 11 standard TCP states in transitions', () => {
    const statesInTransitions = new Set<string>();
    TCP_FSM_TRANSITIONS.forEach((t) => {
      statesInTransitions.add(t.from);
      statesInTransitions.add(t.to);
    });

    ALL_TCP_STATES.forEach((state) => {
      expect(statesInTransitions.has(state)).toBe(true);
    });
  });

  it('correctly executes every defined FSM transition', () => {
    for (const rule of TCP_FSM_TRANSITIONS) {
      const result = transition(rule.from, rule.event);
      expect(result.isValid).toBe(true);
      expect(result.nextState).toBe(rule.to);
      expect(result.rule?.id).toBe(rule.id);
      expect(result.logMessage).toContain(rule.from);
      expect(result.logMessage).toContain(rule.to);
    }
  });

  it('handles invalid transitions cleanly without throwing and leaves state unchanged', () => {
    const invalidPairs: Array<{ state: any; event: TcpEvent }> = [
      { state: 'CLOSED', event: 'RCV_ACK' },
      { state: 'CLOSED', event: 'RCV_FIN' },
      { state: 'LISTEN', event: 'RCV_FIN' },
      { state: 'LISTEN', event: 'TIMEOUT_TIME_WAIT' },
      { state: 'SYN_SENT', event: 'RCV_FIN' },
      { state: 'ESTABLISHED', event: 'APP_OPEN_ACTIVE' },
      { state: 'ESTABLISHED', event: 'APP_OPEN_PASSIVE' },
      { state: 'TIME_WAIT', event: 'APP_SEND' },
      { state: 'CLOSE_WAIT', event: 'RCV_SYN' },
    ];

    for (const { state, event } of invalidPairs) {
      expect(() => {
        const result = transition(state, event);
        expect(result.isValid).toBe(false);
        expect(result.nextState).toBe(state);
        expect(result.logMessage).toContain('Ignored/Invalid');
      }).not.toThrow();
    }
  });

  it('generates React Flow graph data with all 11 states and correct active highlights', () => {
    const { nodes, edges } = getFsmGraphData('ESTABLISHED', 'T_SYN_RCVD_RCV_ACK');

    expect(nodes).toHaveLength(11);
    const establishedNode = nodes.find((n) => n.id === 'ESTABLISHED');
    expect(establishedNode).toBeDefined();
    expect(establishedNode?.data.isActive).toBe(true);

    const closedNode = nodes.find((n) => n.id === 'CLOSED');
    expect(closedNode?.data.isActive).toBe(false);

    expect(edges.length).toBe(TCP_FSM_TRANSITIONS.length);
    const highlightedEdge = edges.find((e) => e.id === 'T_SYN_RCVD_RCV_ACK');
    expect(highlightedEdge?.animated).toBe(true);
  });
});
