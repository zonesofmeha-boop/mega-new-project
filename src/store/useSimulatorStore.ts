import { create } from 'zustand';
import { TcpSimulator } from '../engine/simulator';
import {
  TcpSnapshot,
  TcpPacket,
  EndpointId,
  FailureType,
  FailureConfig,
} from '../engine/types';
import { getScenarioById } from '../engine/scenarios';
import { scheduleSimulationSave } from '../services/simulationPersistence';

export type AppTab = 'visualizer' | 'scenarios' | 'learn' | 'about';

interface SimulatorStoreState {
  simulator: TcpSimulator;
  snapshot: TcpSnapshot;
  simulationId: string;
  activeTab: AppTab;
  selectedScenarioId: string;
  isPlaying: boolean;
  speed: number; // 0.25, 0.5, 1, 2, 4
  theme: 'dark' | 'light';
  selectedPacket: TcpPacket | null;
  stateMachineTarget: EndpointId;
  mss: number;
  customMessage: string;
  logFilter: {
    level: string;
    endpoint: string;
    category: string;
    search: string;
  };

  // Actions
  init: (scenarioId?: string) => void;
  reset: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  seek: (index: number) => void;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  selectPacket: (packet: TcpPacket | null) => void;
  setStateMachineTarget: (target: EndpointId) => void;
  setScenario: (scenarioId: string) => void;
  setActiveTab: (tab: AppTab) => void;
  setMss: (mss: number) => void;
  setCustomMessage: (msg: string) => void;
  setLogFilter: (filter: Partial<SimulatorStoreState['logFilter']>) => void;

  // Simulation controls
  clientOpen: () => void;
  sendData: (text?: string, endpoint?: EndpointId) => void;
  closeConnection: (endpoint?: EndpointId) => void;
  abortConnection: (endpoint?: EndpointId) => void;
  injectFailure: (type: FailureType, config?: Partial<FailureConfig>) => void;
  clearFailures: () => void;
}

function createSimulatorForScenario(scenarioId: string, mss: number = 16): TcpSimulator {
  const scenario = getScenarioById(scenarioId);
  const sim = new TcpSimulator({
    seed: 42,
    clientMss: scenario.initialMss ?? mss,
    serverStartsInListen: scenario.id !== 'port_closed',
  });

  if (scenario.setupEvents && scenario.setupEvents.length > 0) {
    scenario.setupEvents.forEach((setupFn) => setupFn(sim));
    // Start cursor at step 0 so user can step through or hit Play
    sim.seek(0);
  }

  return sim;
}

function createSimulationId(): string {
  return globalThis.crypto.randomUUID();
}

export const useSimulatorStore = create<SimulatorStoreState>((set, get) => {
  const initialScenarioId = 'normal_lifecycle';
  const initialSim = createSimulatorForScenario(initialScenarioId, 16);
  const initialSimulationId = createSimulationId();

  return {
    simulator: initialSim,
    snapshot: initialSim.getSnapshot(),
    simulationId: initialSimulationId,
    activeTab: 'visualizer',
    selectedScenarioId: initialScenarioId,
    isPlaying: false,
    speed: 1,
    theme: 'dark',
    selectedPacket: null,
    stateMachineTarget: 'client',
    mss: 16,
    customMessage: 'TCP Visualizer Stream',
    logFilter: {
      level: 'all',
      endpoint: 'all',
      category: 'all',
      search: '',
    },

    init: (scenarioId = get().selectedScenarioId) => {
      const sim = createSimulatorForScenario(scenarioId, get().mss);
      const simulationId = createSimulationId();
      set({
        simulator: sim,
        snapshot: sim.getSnapshot(),
        simulationId,
        selectedScenarioId: scenarioId,
        isPlaying: false,
        selectedPacket: null,
      });
      scheduleSimulationSave(simulationId, scenarioId, sim);
    },

    reset: () => {
      const scenarioId = get().selectedScenarioId;
      const sim = createSimulatorForScenario(scenarioId, get().mss);
      const simulationId = createSimulationId();
      set({
        simulator: sim,
        snapshot: sim.getSnapshot(),
        simulationId,
        isPlaying: false,
        selectedPacket: null,
      });
      scheduleSimulationSave(simulationId, scenarioId, sim);
    },

    stepForward: () => {
      const { simulator, isPlaying } = get();
      if (!simulator.canStep()) {
        if (isPlaying) set({ isPlaying: false });
        return;
      }
      simulator.step();
      const snap = simulator.getSnapshot();
      set({ snapshot: snap });
      scheduleSimulationSave(get().simulationId, get().selectedScenarioId, simulator);
    },

    stepBackward: () => {
      const { simulator } = get();
      if (!simulator.canStepBack()) return;
      const prevIndex = simulator.getCursor() - 1;
      simulator.seek(prevIndex);
      set({ snapshot: simulator.getSnapshot(), isPlaying: false });
      scheduleSimulationSave(get().simulationId, get().selectedScenarioId, simulator);
    },

    seek: (index: number) => {
      const { simulator } = get();
      simulator.seek(index);
      set({ snapshot: simulator.getSnapshot(), isPlaying: false });
      scheduleSimulationSave(get().simulationId, get().selectedScenarioId, simulator);
    },

    togglePlay: () => {
      const current = get().isPlaying;
      if (!current && !get().simulator.canStep()) {
        // At the end, restart from beginning if user clicks play
        get().seek(0);
      }
      set({ isPlaying: !current });
    },

    setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),

    setSpeed: (speed: number) => set({ speed }),

    setTheme: (theme: 'dark' | 'light') => {
      if (typeof document !== 'undefined') {
        if (theme === 'light') {
          document.documentElement.classList.add('light');
        } else {
          document.documentElement.classList.remove('light');
        }
      }
      set({ theme });
    },

    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      get().setTheme(next);
    },

    selectPacket: (packet: TcpPacket | null) => set({ selectedPacket: packet }),

    setStateMachineTarget: (target: EndpointId) => set({ stateMachineTarget: target }),

    setScenario: (scenarioId: string) => {
      const scenario = getScenarioById(scenarioId);
      const effectiveMss = scenario.initialMss ?? get().mss;
      const sim = createSimulatorForScenario(scenarioId, effectiveMss);
      const simulationId = createSimulationId();
      set({
        selectedScenarioId: scenarioId,
        simulationId,
        mss: effectiveMss,
        customMessage: scenario.initialMessage ?? get().customMessage,
        simulator: sim,
        snapshot: sim.getSnapshot(),
        isPlaying: false,
        selectedPacket: null,
      });
      scheduleSimulationSave(simulationId, scenarioId, sim);
    },

    setActiveTab: (tab: AppTab) => set({ activeTab: tab }),

    setMss: (mss: number) => set({ mss: Math.max(1, Math.min(1460, mss)) }),

    setCustomMessage: (msg: string) => set({ customMessage: msg }),

    setLogFilter: (filterUpdate) =>
      set((state) => ({ logFilter: { ...state.logFilter, ...filterUpdate } })),

    clientOpen: () => {
      const { simulator } = get();
      simulator.clientOpen();
      simulator.step();
      set({ snapshot: simulator.getSnapshot() });
      scheduleSimulationSave(get().simulationId, get().selectedScenarioId, simulator);
    },

    sendData: (text?: string, endpoint: EndpointId = 'client') => {
      const { simulator, customMessage } = get();
      const msg = text ?? customMessage;
      simulator.sendData(msg, endpoint);
      simulator.step();
      set({ snapshot: simulator.getSnapshot() });
      scheduleSimulationSave(get().simulationId, get().selectedScenarioId, simulator);
    },

    closeConnection: (endpoint: EndpointId = 'client') => {
      const { simulator } = get();
      simulator.closeConnection(endpoint);
      simulator.step();
      set({ snapshot: simulator.getSnapshot() });
      scheduleSimulationSave(get().simulationId, get().selectedScenarioId, simulator);
    },

    abortConnection: (endpoint: EndpointId = 'client') => {
      const { simulator } = get();
      simulator.abortConnection(endpoint);
      simulator.step();
      set({ snapshot: simulator.getSnapshot() });
      scheduleSimulationSave(get().simulationId, get().selectedScenarioId, simulator);
    },

    injectFailure: (type: FailureType, config?: Partial<FailureConfig>) => {
      const { simulator } = get();
      simulator.setFailure(type, true, config);
      set({ snapshot: simulator.getSnapshot() });
      scheduleSimulationSave(get().simulationId, get().selectedScenarioId, simulator);
    },

    clearFailures: () => {
      const { simulator } = get();
      simulator.clearAllFailures();
      set({ snapshot: simulator.getSnapshot() });
      scheduleSimulationSave(get().simulationId, get().selectedScenarioId, simulator);
    },
  };
});
