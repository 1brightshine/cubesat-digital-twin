/**
 * Real NASA Data Power Budget Modal
 * Full modal dialog for electrical power system (EPS) engineering analysis.
 */

import React from 'react';
import { KeplerianElements, CubeSatSpec, OrbitDerivedState, SpiceGeometryState } from '../types';
import { PowerBudgetPanel } from './PowerBudgetPanel';
import { Zap, X, ShieldCheck } from 'lucide-react';

interface PowerBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: KeplerianElements;
  cubeSat?: CubeSatSpec;
  derivedState: OrbitDerivedState;
  spice?: SpiceGeometryState;
}

export const PowerBudgetModal: React.FC<PowerBudgetModalProps> = ({
  isOpen,
  onClose,
  elements,
  cubeSat,
  derivedState,
  spice,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in select-none">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-950/95 border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden font-mono text-xs">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100 font-mono tracking-wide">
                  CUBESAT POWER BUDGET &amp; EPS ANALYSIS
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  NASA AM0 Standards
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                SORCE / TSIS-1 solar constant (1361 W/m²), triple-junction GaAs solar array, and battery DoD margins
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <PowerBudgetPanel
            elements={elements}
            cubeSat={cubeSat}
            derivedState={derivedState}
            spice={spice}
            isCompact={false}
          />
        </div>
      </div>
    </div>
  );
};
