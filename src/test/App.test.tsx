import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../App';
import { useSimulatorStore } from '../store/useSimulatorStore';

// Mock ResizeObserver for React Flow and Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('TCP Simulator Web App UI End-to-End Tests', () => {
  beforeEach(() => {
    act(() => {
      useSimulatorStore.getState().init('normal_lifecycle');
      useSimulatorStore.getState().setActiveTab('visualizer');
      useSimulatorStore.getState().setTheme('dark');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all core visualizer dashboard panels and endpoints', () => {
    render(<App />);

    // Brand and header
    expect(screen.getByText(/TCP Simulator & Visualizer/i)).toBeInTheDocument();
    expect(screen.getByText(/RFC 793 FSM/i)).toBeInTheDocument();

    // Endpoints
    expect(screen.getAllByText(/Client/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Server/i).length).toBeGreaterThan(0);

    // Sequence & State Diagrams
    expect(screen.getByText(/Sequence Ladder Diagram/i)).toBeInTheDocument();
    expect(screen.getByText(/RFC 793 State Machine FSM/i)).toBeInTheDocument();

    // Inspector, Log, Stats, Failures, Composer
    expect(screen.getByText(/Packet Inspector/i)).toBeInTheDocument();
    expect(screen.getByText(/Protocol Event Log/i)).toBeInTheDocument();
    expect(screen.getByText(/Network Failure Injection/i)).toBeInTheDocument();
    expect(screen.getByText(/Message Composer/i)).toBeInTheDocument();
    expect(screen.getByText(/Metrics & Analytics/i)).toBeInTheDocument();
  });

  it('guarantees state consistency on Next x5 then Previous x5', () => {
    render(<App />);

    const nextBtn = screen.getByRole('button', { name: /Next Step/i });
    const prevBtn = screen.getByRole('button', { name: /Previous Step/i });

    const initialStep = useSimulatorStore.getState().snapshot.stepIndex;
    const initialClientState = useSimulatorStore.getState().snapshot.client.state;
    const initialServerState = useSimulatorStore.getState().snapshot.server.state;

    // Step forward 5 times
    for (let i = 0; i < 5; i++) {
      fireEvent.click(nextBtn);
    }
    expect(useSimulatorStore.getState().snapshot.stepIndex).toBe(initialStep + 5);

    // Step backward 5 times
    for (let i = 0; i < 5; i++) {
      fireEvent.click(prevBtn);
    }

    // Must return to exact initial state
    expect(useSimulatorStore.getState().snapshot.stepIndex).toBe(initialStep);
    expect(useSimulatorStore.getState().snapshot.client.state).toBe(initialClientState);
    expect(useSimulatorStore.getState().snapshot.server.state).toBe(initialServerState);
  });

  it('toggles Play and Pause cleanly', () => {
    render(<App />);

    const playBtn = screen.getByRole('button', { name: /Start/i });
    expect(useSimulatorStore.getState().isPlaying).toBe(false);

    fireEvent.click(playBtn);
    expect(useSimulatorStore.getState().isPlaying).toBe(true);

    const pauseBtn = screen.getByRole('button', { name: /Pause/i });
    fireEvent.click(pauseBtn);
    expect(useSimulatorStore.getState().isPlaying).toBe(false);
  });

  it('toggles between dark and light themes using CSS variables', () => {
    render(<App />);

    const themeBtn = screen.getByRole('button', { name: /Toggle Theme/i });
    expect(useSimulatorStore.getState().theme).toBe('dark');

    fireEvent.click(themeBtn);
    expect(useSimulatorStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);

    fireEvent.click(themeBtn);
    expect(useSimulatorStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('injects failure modes and displays active failure cues', () => {
    render(<App />);

    const dropPktBtn = screen.getByRole('button', { name: /Drop Packet/i });
    fireEvent.click(dropPktBtn);

    const snapshot = useSimulatorStore.getState().snapshot;
    expect(snapshot.activeFailure).toBeDefined();
    expect(snapshot.activeFailure?.type).toBe('packet_loss');
    expect(screen.getByText(/Active Failure Cue/i)).toBeInTheDocument();
  });

  it('navigates seamlessly across all 4 main tabs', () => {
    render(<App />);

    // 1. Scenarios Gallery
    const scenariosTab = screen.getByRole('button', { name: /Scenarios/i });
    fireEvent.click(scenariosTab);
    expect(screen.getByText(/Pre-Configured Scenarios Gallery/i)).toBeInTheDocument();
    expect(screen.getByText(/Normal Connection Lifecycle/i)).toBeInTheDocument();
    expect(screen.getByText(/Fast Retransmit on 3 Duplicate ACKs/i)).toBeInTheDocument();

    // 2. Learn & Quiz
    const learnTab = screen.getByRole('button', { name: /Learn & Quiz/i });
    fireEvent.click(learnTab);
    expect(screen.getByText(/TCP Protocol Masterclass & Quizzes/i)).toBeInTheDocument();
    expect(screen.getAllByText(/The Three-Way Handshake/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/RFC 793 Protocol Glossary/i)).toBeInTheDocument();

    // 3. About Page
    const aboutTab = screen.getByRole('button', { name: /About & RFC 793/i });
    fireEvent.click(aboutTab);
    expect(screen.getByText(/About TCP Simulator & RFC 793 State Visualizer/i)).toBeInTheDocument();
    expect(screen.getByText(/Pure Engine Isolation/i)).toBeInTheDocument();

    // 4. Return to Visualizer
    const visualizerTab = screen.getByRole('button', { name: /Visualizer/i });
    fireEvent.click(visualizerTab);
    expect(screen.getByText(/Message Composer & MSS Segmentation/i)).toBeInTheDocument();
  });

  it('interacts with the Learn page mini sandbox and quiz', () => {
    render(<App />);

    const learnTab = screen.getByRole('button', { name: /Learn & Quiz/i });
    fireEvent.click(learnTab);

    // Mini sandbox Step Forward
    const stepBtn = screen.getByRole('button', { name: /Step Forward/i });
    fireEvent.click(stepBtn);

    // Answer Quiz Question
    const correctOption = screen.getByRole('button', { name: '1001' });
    fireEvent.click(correctOption);

    expect(screen.getByText(/Correct!/i)).toBeInTheDocument();
    expect(screen.getByText(/Under RFC 793, the SYN flag consumes 1 sequence number/i)).toBeInTheDocument();
  });
});
