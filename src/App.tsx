import React from 'react';
import { useSimulatorStore } from './store/useSimulatorStore';
import { Header } from './components/Header';
import { VisualizerPage } from './pages/VisualizerPage';
import { ScenariosPage } from './pages/ScenariosPage';
import { LearnPage } from './pages/LearnPage';
import { AboutPage } from './pages/AboutPage';
import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  const { activeTab } = useSimulatorStore();

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-primary">
        <Header />

        <div className="flex-1">
          {activeTab === 'visualizer' && <VisualizerPage />}
          {activeTab === 'scenarios' && <ScenariosPage />}
          {activeTab === 'learn' && <LearnPage />}
          {activeTab === 'about' && <AboutPage />}
        </div>

        {/* Global Footer with Shortcuts */}
        <footer className="border-t border-border bg-surface/50 py-4 px-4 text-xs text-foreground-muted">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <span className="font-semibold text-foreground">TCP Protocol Simulator &amp; Visualizer</span> &bull; RFC 793 Compliant Discrete-Event Engine
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[11px]">
              <span className="text-foreground-muted">Shortcuts:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-foreground">Space</kbd> Play/Pause
              <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-foreground">&rarr;</kbd> Next
              <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-foreground">&larr;</kbd> Prev
              <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-foreground">R</kbd> Reset
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
};

export default App;
