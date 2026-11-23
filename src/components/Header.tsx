import React from 'react';
import { useSimulatorStore } from '../store/useSimulatorStore';
import {
  Activity,
  Layers,
  BookOpen,
  Info,
  Sun,
  Moon,
} from 'lucide-react';

export const Header: React.FC = () => {
  const { activeTab, setActiveTab, theme, toggleTheme, snapshot } = useSimulatorStore();

  const navItems = [
    { id: 'visualizer' as const, label: 'Visualizer', icon: Activity },
    { id: 'scenarios' as const, label: 'Scenarios', icon: Layers, badge: '12' },
    { id: 'learn' as const, label: 'Learn & Quiz', icon: BookOpen, badge: '8' },
    { id: 'about' as const, label: 'About & RFC 793', icon: Info },
  ];

  return (
    <header className="border-b border-border bg-surface/90 backdrop-blur sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-md shadow-primary/20">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                TCP Simulator & Visualizer
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-muted text-primary border border-primary/20">
                RFC 793 FSM
              </span>
            </div>
            <p className="text-xs text-foreground-muted hidden sm:block">
              Deterministic Discrete-Event Engine & State Visualizer
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-primary text-white shadow-sm shadow-primary/30'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-elevated'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-surface-elevated text-foreground-muted'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right tools: Theme Toggle & State Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono bg-surface-elevated px-3 py-1.5 rounded-lg border border-border">
            <span className="w-2 h-2 rounded-full bg-success animate-ping" />
            <span className="text-foreground-muted">Virtual Time:</span>
            <span className="font-bold text-primary">{snapshot.virtualTime} ms</span>
            <span className="text-border">|</span>
            <span className="text-foreground-muted">Step:</span>
            <span className="font-bold text-foreground">#{snapshot.stepIndex}</span>
          </div>

          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className="p-2 rounded-lg bg-surface-elevated hover:bg-border/60 text-foreground transition-colors border border-border"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-warning" /> : <Moon className="w-4 h-4 text-primary" />}
          </button>
        </div>
      </div>
    </header>
  );
};
