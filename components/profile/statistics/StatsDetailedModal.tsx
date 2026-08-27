'use client';

import React, { useEffect, useState } from 'react';

interface MemberStat {
  id: string;
  name: string;
  role: string;
  attendancesCount: number;
  lastActive: string;
  balanceStatus: 'paid' | 'pending';
}

interface StatsDetailedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StatsDetailedModal({ isOpen, onClose }: StatsDetailedModalProps) {
  const [detailedStats, setDetailedStats] = useState<MemberStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      const fetchDetailedStats = async () => {
        setLoading(true);
        try {
          setLoading(false);
        } catch (error) {
          console.error('Hiba a részletes adatok betöltésekor:', error);
          setLoading(false);
        }
      };

      fetchDetailedStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-slate-100">
            Részletes statisztika (Név szerinti bontás)
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors text-xl font-bold px-2"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Adatok betöltése...</div>
          ) : (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-800/60 text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3">Név</th>
                  <th className="px-4 py-3">Szerepkör</th>
                  <th className="px-4 py-3 text-center">Részvétel (alkalom)</th>
                  <th className="px-4 py-3 text-right">Státusz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {detailedStats.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-slate-200">{item.name}</td>
                    <td className="px-4 py-3 text-slate-400">{item.role}</td>
                    <td className="px-4 py-3 text-center">{item.attendancesCount}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded-full ${
                          item.balanceStatus === 'paid'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                            : 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                        }`}
                      >
                        {item.balanceStatus === 'paid' ? 'Rendezett' : 'Függőben'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex justify-end bg-slate-900/40">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Bezárás
          </button>
        </div>
      </div>
    </div>
  );
}