import React, { useEffect } from 'react';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { SCENARIOS } from '../engine/scenarios';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Gauge,
  ChevronDown,
} from 'lucide-react';

export const ControlsBar: React.FC = () => {
  const {
    snapshot,
    isPlaying,
    speed,
    selectedScenarioId,
    togglePlay,
    setIsPlaying,
    setSpeed,
    stepForward,
    stepBackward,
    reset,
    seek,
    setScenario,
    simulator,
  } = useSimulatorStore();

  const totalSteps = simulator.getHistoryLength();
  const currentStep = snapshot.stepIndex;
  const canStepNext = simulator.canStep();
  const canStepPrev = simulator.canStepBack();

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = Math.max(50, 600 / speed);
    const timer = setInterval(() => {
      if (!simulator.canStep()) {
        setIsPlaying(false);
      } else {
        stepForward();
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, speed, simulator, stepForward, setIsPlaying]);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (canStepNext) stepForward();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (canStepPrev) stepBackward();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        reset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, stepForward, stepBackward, reset, canStepNext, canStepPrev]);

  const speedOptions = [0.25, 0.5, 1, 2, 4];

  return (
    <div className="bg-surface border-b border-border p-4 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Scenario Selection dropdown */}
        <div className="w-full md:w-auto flex items-center gap-2">
          <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wider hidden sm:block">
            Scenario:
          </label>
          <div className="relative w-full sm:w-72">
            <select
              value={selectedScenarioId}
              onChange={(e) => setScenario(e.target.value)}
              className="w-full appearance-none bg-surface-elevated border border-border hover:border-primary/50 text-foreground text-xs sm:text-sm font-medium rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer truncate"
            >
              {SCENARIOS.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  [{sc.category}] {sc.title}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-foreground-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Primary Playback Controls */}
        <div className="flex items-center gap-2">
          {/* Previous Step button */}
          <button
            onClick={stepBackward}
            disabled={!canStepPrev}
            title="Previous Step (ArrowLeft)"
            aria-label="Previous Step"
            className="p-2.5 rounded-lg bg-surface-elevated hover:bg-border text-foreground disabled:opacity-30 disabled:cursor-not-allowed border border-border transition-all active:scale-95"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Play / Pause toggle button */}
          <button
            onClick={togglePlay}
            title={isPlaying ? 'Pause Simulation (Space)' : 'Start Simulation (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Start'}
            className={`px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95 ${
              isPlaying
                ? 'bg-warning hover:bg-warning/90 text-white shadow-warning/20'
                : 'bg-primary hover:bg-primary-hover text-white shadow-primary/20'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{canStepNext ? 'Play' : 'Replay'}</span>
              </>
            )}
          </button>

          {/* Next Step button */}
          <button
            onClick={stepForward}
            disabled={!canStepNext}
            title="Next Step (ArrowRight)"
            aria-label="Next Step"
            className="p-2.5 rounded-lg bg-surface-elevated hover:bg-border text-foreground disabled:opacity-30 disabled:cursor-not-allowed border border-border transition-all active:scale-95"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Reset button */}
          <button
            onClick={reset}
            title="Reset Simulation (R)"
            aria-label="Reset Simulation"
            className="p-2.5 rounded-lg bg-surface-elevated hover:bg-border text-foreground border border-border transition-all active:scale-95 ml-1"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed Presets */}
          <div className="hidden sm:flex items-center gap-1 bg-surface-elevated p-1 rounded-lg border border-border ml-2">
            <Gauge className="w-3.5 h-3.5 text-foreground-muted ml-1 mr-0.5" />
            {speedOptions.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  speed === s
                    ? 'bg-primary text-white'
                    : 'text-foreground-muted hover:text-foreground'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Timeline Scrubber */}
        <div className="w-full md:w-64 flex items-center gap-3">
          <span className="text-xs font-mono text-foreground-muted">
            {currentStep}/{Math.max(0, totalSteps - 1)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(0, totalSteps - 1)}
            value={currentStep}
            onChange={(e) => seek(parseInt(e.target.value, 10))}
            className="w-full accent-primary h-2 bg-surface-elevated rounded-lg cursor-pointer"
            aria-label="Timeline Scrubber"
          />
        </div>
      </div>
    </div>
  );
};
