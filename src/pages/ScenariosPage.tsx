import React, { useState } from 'react';
import { SCENARIOS } from '../engine/scenarios';
import { useSimulatorStore } from '../store/useSimulatorStore';
import {
  CheckCircle2,
  Play,
} from 'lucide-react';

export const ScenariosPage: React.FC = () => {
  const { setScenario, setActiveTab, selectedScenarioId } = useSimulatorStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Normal', 'Failures', 'Advanced'];

  const filteredScenarios = SCENARIOS.filter((sc) => {
    if (selectedCategory === 'All') return true;
    return sc.category === selectedCategory;
  });

  const handleLaunch = (scenarioId: string) => {
    setScenario(scenarioId);
    setActiveTab('visualizer');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Pre-Configured Scenarios Gallery
            </h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-primary-muted text-primary border border-primary/20">
              12 Scenarios
            </span>
          </div>
          <p className="text-sm text-foreground-muted mt-1">
            Explore authentic RFC 793 network scenarios from standard handshakes to complex failure recoveries.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 bg-surface-elevated p-1 rounded-xl border border-border">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredScenarios.map((sc) => {
          const isCurrentlyActive = selectedScenarioId === sc.id;

          return (
            <div
              key={sc.id}
              className={`bg-surface border rounded-xl p-5 shadow-sm flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-md ${
                isCurrentlyActive
                  ? 'border-primary ring-1 ring-primary/40'
                  : 'border-border'
              }`}
            >
              <div>
                {/* Category & Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-mono font-semibold uppercase text-primary">
                    {sc.category}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-elevated text-foreground-muted border border-border">
                    {sc.badge}
                  </span>
                </div>

                {/* Scenario Title */}
                <h3 className="font-bold text-base text-foreground mb-2 flex items-center gap-2">
                  {sc.title}
                  {isCurrentlyActive && (
                    <span className="w-2 h-2 rounded-full bg-success" title="Currently Loaded" />
                  )}
                </h3>

                {/* Summary */}
                <p className="text-xs text-foreground-muted leading-relaxed mb-4">
                  {sc.summary}
                </p>

                {/* Learning Objectives */}
                <div className="space-y-1.5 mb-5">
                  <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider block">
                    Learning Objectives:
                  </span>
                  {sc.objectives.map((obj, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-foreground-muted">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                      <span>{obj}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Launch Button */}
              <button
                onClick={() => handleLaunch(sc.id)}
                className={`w-full py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${
                  isCurrentlyActive
                    ? 'bg-success hover:bg-success/90 text-white shadow-success/20'
                    : 'bg-primary hover:bg-primary-hover text-white shadow-primary/20'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {isCurrentlyActive ? 'Loaded in Visualizer \u2192' : 'Simulate Scenario'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
