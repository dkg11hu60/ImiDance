'use client';

import React, { useState } from 'react';
import { StatsDetailedModal } from './StatsDetailedModal';

interface StatisticsOverviewProps {
  userPermissions: string[];
  summaryData: {
    totalMembers: number;
    activeMembers: number;
    totalRevenue: number;
    totalEvents: number;
  };
}

export function StatisticsOverview({ userPermissions, summaryData }: StatisticsOverviewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canViewOverview = userPermissions.includes('stats.all');
  const canViewDetailed = userPermissions.includes('stats.detailed');

  if (!canViewOverview) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-100">Összesített statisztika</h2>
        
        {canViewDetailed && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 rounded-lg hover:bg-emerald-900/50 transition-colors"
          >
            Név szerinti részletezés
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/40">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Összes Tag</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{summaryData.totalMembers}</p>
        </div>

        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/40">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Aktív Tagok</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{summaryData.activeMembers}</p>
        </div>

        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/40">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Megtartott Órák</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{summaryData.totalEvents}</p>
        </div>

        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/40">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Összes Bevétel</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{summaryData.totalRevenue.toLocaleString('hu-HU')} Ft</p>
        </div>
      </div>

      {canViewDetailed && isModalOpen && (
        <StatsDetailedModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
}