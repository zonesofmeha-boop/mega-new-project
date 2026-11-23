import { getScenarioById } from '../engine/scenarios';
import { TcpSimulator } from '../engine/simulator';
import { TcpSnapshot } from '../engine/types';

let saveTimeout: ReturnType<typeof setTimeout> | undefined;

export function scheduleSimulationSave(
  simulationId: string,
  scenarioId: string,
  simulator: TcpSimulator,
): void {
  if (!import.meta.env.PROD) return;

  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    const snapshot = simulator.getSnapshot();
    const scenario = getScenarioById(scenarioId);
    const history = simulator.getHistory()
      .slice(0, simulator.getCursor() + 1)
      .slice(-500)
      .map((item) => ({
        stepIndex: item.stepIndex,
        virtualTime: item.virtualTime,
        clientState: item.client.state,
        serverState: item.server.state,
        eventDescription: item.lastEventDescription,
      }));

    void fetch('/api/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createSimulationRecord(simulationId, scenario, snapshot, history)),
    }).then((response) => {
      if (!response.ok) {
        console.error(`Simulator history could not be saved (HTTP ${response.status}).`);
      }
    }).catch(() => {
      console.error('Simulator history could not be saved; the API is unavailable.');
    });
  }, 750);
}

function createSimulationRecord(
  simulationId: string,
  scenario: ReturnType<typeof getScenarioById>,
  snapshot: TcpSnapshot,
  history: Array<{
    stepIndex: number;
    virtualTime: number;
    clientState: string;
    serverState: string;
    eventDescription: string;
  }>,
) {
  return {
    simulationId,
    scenario: {
      id: scenario.id,
      title: scenario.title,
      category: scenario.category,
    },
    history,
    events: snapshot.logs,
    packetHistory: snapshot.packetHistory,
    clientState: snapshot.client,
    serverState: snapshot.server,
    result: snapshot.stats,
  };
}
