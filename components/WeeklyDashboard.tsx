import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Calendar, AlertTriangle, RefreshCw, CheckCircle2, ClipboardCopy } from 'lucide-react';

import DayRow from './DayRow';
import WeekChart from './WeekChart';
import ImportModal from './ImportModal';
import { DayLog, WeekStats, UserSettings } from '../types';
import { WEEK_DAYS, WEEKLY_TARGET_HOURS } from '../constants';
import { calculateDuration, calculateWeekStats, decimalToDuration, distributeDeficit, getSmartSuggestions } from '../services/timeUtils';
import { parseKekaText } from '../services/kekaParser';

interface Props {
  settings: UserSettings;
}

const WeeklyDashboard: React.FC<Props> = ({ settings }) => {
  const [currentDate] = useState(new Date());
  const [showImport, setShowImport] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Initialize Week Data
  const [days, setDays] = useState<DayLog[]>(() => {
    // Try to load from local storage first to persist between view switches
    const saved = localStorage.getItem('worksync_days');
    if (saved) {
        return JSON.parse(saved);
    }

    const monday = startOfWeek(currentDate, { weekStartsOn: 1 });
    return WEEK_DAYS.map((dayConfig, index) => {
      const date = addDays(monday, index);
      return {
        id: dayConfig.id,
        label: dayConfig.label,
        dateStr: format(date, 'MMM dd'),
        isToday: isSameDay(date, new Date()),
        punchIn: '',
        punchOut: '',
        grossHours: 0,
        deficit: 0,
        note: '',
        status: isSameDay(date, new Date()) ? 'PRESENT' : date < new Date() ? 'PAST' : 'FUTURE',
        leaveType: 'NONE'
      } as DayLog;
    });
  });

  const [stats, setStats] = useState<WeekStats>({
    totalWorked: 0,
    requiredTotal: WEEKLY_TARGET_HOURS,
    originalTarget: WEEKLY_TARGET_HOURS,
    totalLeaveDeduction: 0,
    remainingWeekly: WEEKLY_TARGET_HOURS,
    weeklyDeficit: 0,
    projectedTotal: 0,
    isOnTrack: false
  });

  // --- AUTO IMPORT FROM BOOKMARKLET ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const importData = params.get('keka_import');
    
    if (importData) {
      try {
        const decodedText = decodeURIComponent(importData);
        // We use the setter function to access the most current state of 'days' 
        setDays(currentDays => {
            const updated = parseKekaText(decodedText, currentDays, settings);
            return updated;
        });

        // Clear the URL so we don't re-import on refresh
        window.history.replaceState({}, '', window.location.pathname);
        setToastMessage('Data imported successfully!');
        setTimeout(() => setToastMessage(''), 3000);
      } catch (e) {
        console.error("Failed to process auto-import", e);
      }
    }
  }, [settings]);

  // Persist days when changed
  useEffect(() => {
    localStorage.setItem('worksync_days', JSON.stringify(days));
  }, [days]);

  // Recalculate stats whenever days change
  useEffect(() => {
    const newStats = calculateWeekStats(days);
    setStats(newStats);
  }, [days]);

  // Handler for updating a day
  const handleUpdateDay = useCallback((id: string, field: keyof DayLog, value: any) => {
    setDays(prev => {
      return prev.map(day => {
        if (day.id === id) {
          const updatedDay = { ...day, [field]: value };
          
          // Logic for Leave changes
          if (field === 'leaveType') {
             if (value === 'FULL') {
               // Clear punches for full leave
               updatedDay.punchIn = '';
               updatedDay.punchOut = '';
               updatedDay.grossHours = 0;
             } 
          }

          // Auto-calculate gross hours if times are present
          if (field === 'punchIn' || field === 'punchOut' || field === 'leaveType') {
             updatedDay.grossHours = calculateDuration(updatedDay.punchIn, updatedDay.punchOut);
          }
          return updatedDay;
        }
        return day;
      });
    });
  }, []);

  const handleResetDay = useCallback((id: string) => {
    setDays(prev => prev.map(day => {
        if (day.id === id) {
            return {
                ...day,
                punchIn: '',
                punchOut: '',
                grossHours: 0
            };
        }
        return day;
    }));
  }, []);

  // Auto-Plan / Redistribute Deficit
  const handleAutoPlan = () => {
    const updatedDays = distributeDeficit(days, settings);
    setDays(updatedDays);
  };

  const handleImport = (updatedDays: DayLog[]) => {
    setDays(updatedDays);
    setToastMessage('Import complete!');
    setTimeout(() => setToastMessage(''), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in relative">
        {/* Toast Notification */}
        {toastMessage && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-2 rounded-full shadow-lg font-bold text-sm animate-in slide-in-from-top-4 fade-in">
                {toastMessage}
            </div>
        )}

        {showImport && (
            <ImportModal 
                currentDays={days} 
                settings={settings}
                onImport={handleImport} 
                onClose={() => setShowImport(false)} 
            />
        )}

        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-start">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Worked / Target</span>
                        {stats.totalLeaveDeduction > 0 && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full">
                                -{decimalToDuration(stats.totalLeaveDeduction)} Leave Credit
                            </span>
                        )}
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mt-2">
                        {decimalToDuration(stats.totalWorked)} 
                        <span className="text-lg text-slate-400 font-normal"> / {decimalToDuration(stats.requiredTotal)}</span>
                    </div>
                </div>
                <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                        className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (stats.totalWorked / Math.max(1, stats.requiredTotal)) * 100)}%` }}
                    ></div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Remaining to Work</span>
                <div className="text-3xl font-bold text-slate-900 mt-2">{decimalToDuration(stats.remainingWeekly)}</div>
                <div className="mt-2 text-sm text-slate-500">
                    To reach adjusted target
                </div>
            </div>

            <div className={`p-6 rounded-2xl shadow-sm border flex flex-col justify-center items-start
                ${!stats.isOnTrack 
                    ? 'bg-red-50 border-red-100' 
                    : 'bg-emerald-50 border-emerald-100'}`
            }>
                <div className="flex items-center gap-2 mb-2">
                    {!stats.isOnTrack 
                        ? <AlertTriangle className="w-5 h-5 text-red-500" />
                        : <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    }
                    <span className={`text-sm font-bold uppercase tracking-wider ${!stats.isOnTrack ? 'text-red-600' : 'text-emerald-600'}`}>
                        {!stats.isOnTrack ? 'Action Needed' : 'On Track'}
                    </span>
                </div>
                <p className={`text-sm ${!stats.isOnTrack ? 'text-red-700' : 'text-emerald-700'}`}>
                    {!stats.isOnTrack 
                        ? "You are projected to miss the weekly target. Use Auto-Plan or apply Leave." 
                        : "Great job! You are on track to meet your adjusted weekly goal."}
                </p>
            </div>
        </div>

        {/* Mobile Auto Plan Button */}
        <div className="md:hidden flex gap-2">
             <button 
                onClick={() => setShowImport(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-4 py-3 rounded-xl text-sm font-bold transition-colors"
            >
                <ClipboardCopy className="w-4 h-4" />
                <span>Import</span>
             </button>
             <button 
                onClick={handleAutoPlan}
                className="flex-[2] flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-slate-200"
            >
                <RefreshCw className="w-4 h-4" />
                <span>Auto-Plan Remainder</span>
             </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Days List */}
            <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-slate-400" />
                        Weekly Schedule
                    </h2>
                    
                    <div className="hidden md:flex gap-2">
                        <button 
                            onClick={() => setShowImport(true)}
                            className="flex items-center gap-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                        >
                            <ClipboardCopy className="w-3 h-3" />
                            <span>Import from Keka</span>
                        </button>

                        <button 
                            onClick={handleAutoPlan}
                            className="flex items-center gap-2 text-slate-500 hover:text-blue-600 px-3 py-1 rounded-lg text-xs font-medium transition-colors border border-slate-200 hover:border-blue-200 hover:bg-blue-50"
                        >
                            <RefreshCw className="w-3 h-3" />
                            <span>Auto-Plan</span>
                        </button>
                    </div>
                </div>
                
                <div className="space-y-3">
                    {days.map(day => (
                        <DayRow 
                            key={day.id} 
                            day={day} 
                            settings={settings}
                            onUpdate={handleUpdateDay}
                            onReset={handleResetDay}
                            suggestions={getSmartSuggestions(day, days, settings)}
                        />
                    ))}
                </div>
            </div>

            {/* Right Sidebar: Charts & Instructions */}
            <div className="space-y-6">
                <WeekChart days={days} />

                {/* Rules Card */}
                <div className="bg-slate-900 text-slate-300 p-6 rounded-xl text-sm leading-relaxed">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-white font-bold text-base">Current Rules</h3>
                    </div>
                    
                    <ul className="space-y-2">
                         <li className="flex gap-2">
                            <span className="text-blue-400 font-bold">•</span>
                            <span>Target: <b className="text-white">47.5h/week</b></span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-blue-400 font-bold">•</span>
                            <span>Late: After <b className="text-red-300">
                                {(() => {
                                    const [h, m] = settings.standardInTime.split(':').map(Number);
                                    const total = h * 60 + m + settings.lateBufferMinutes;
                                    const h2 = Math.floor(total / 60);
                                    const m2 = total % 60;
                                    return `${h2.toString().padStart(2,'0')}:${m2.toString().padStart(2,'0')}`;
                                })()}
                            </b></span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-blue-400 font-bold">•</span>
                            <span>Max Out: {settings.enableMaxTime ? <b className="text-white">{settings.maxOutTime}</b> : <b className="text-emerald-400">None</b>}</span>
                        </li>
                    </ul>
                </div>

                {/* Dynamic Advice Box */}
                 {stats.weeklyDeficit > 1 && stats.remainingWeekly > 0 && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                        <h4 className="text-amber-800 font-bold text-sm mb-1 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Recover Deficit
                        </h4>
                        <p className="text-amber-700 text-xs">
                            Consider applying a <span className="font-bold">Half-Day Leave</span> to a previous day if you cannot make up the hours.
                        </p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default WeeklyDashboard;