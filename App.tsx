import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Briefcase, AlertTriangle, RefreshCw, Calendar, CheckCircle2, Download, Share, X } from 'lucide-react';

import DayRow from './components/DayRow';
import WeekChart from './components/WeekChart';
import { DayLog, WeekStats } from './types';
import { WEEK_DAYS, WEEKLY_TARGET_HOURS } from './constants';
import { calculateDuration, calculateWeekStats, decimalToDuration, distributeDeficit, getSmartSuggestions } from './services/timeUtils';

function App() {
  const [currentDate] = useState(new Date());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosInstall, setShowIosInstall] = useState(false);
  
  // Initialize Week Data
  const [days, setDays] = useState<DayLog[]>(() => {
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

  // Handle PWA Install Prompt & iOS Detection
  useEffect(() => {
    // Android/Desktop Prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Detection
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    if (isIos && !isStandalone) {
      // Show iOS instructions after a small delay
      const timer = setTimeout(() => setShowIosInstall(true), 2000);
      return () => clearTimeout(timer);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

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
    const updatedDays = distributeDeficit(days);
    setDays(updatedDays);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 relative">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
                <Briefcase className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">WorkSync</h1>
          </div>
          <div className="flex items-center gap-4">
             {deferredPrompt && (
               <button 
                  onClick={handleInstallClick}
                  className="flex items-center gap-2 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
               >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Install</span>
               </button>
             )}
             
             <div className="hidden md:flex flex-col items-end">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Net Target</span>
                <span className={`text-sm font-bold ${stats.isOnTrack ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {decimalToDuration(stats.requiredTotal)}
                </span>
             </div>
             <button 
                onClick={handleAutoPlan}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-slate-200"
            >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Auto-Plan</span>
             </button>
          </div>
        </div>
      </header>

      {/* iOS Install Instruction Banner */}
      {showIosInstall && (
        <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 relative">
            <button 
              onClick={() => setShowIosInstall(false)}
              className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="bg-slate-800 p-2 rounded-lg">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Install WorkSync</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                To install on iOS, tap <Share className="w-3 h-3 inline mx-1" /> <b>Share</b> and select <br/>
                <span className="font-bold text-white bg-slate-700 px-1.5 py-0.5 rounded text-[10px] mt-1 inline-block">
                   + Add to Home Screen
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Days List */}
            <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-slate-400" />
                        Weekly Schedule
                    </h2>
                </div>
                
                <div className="space-y-3">
                    {days.map(day => (
                        <DayRow 
                            key={day.id} 
                            day={day} 
                            onUpdate={handleUpdateDay}
                            onReset={handleResetDay}
                            suggestions={getSmartSuggestions(day, days)}
                        />
                    ))}
                </div>
            </div>

            {/* Right Sidebar: Charts & Instructions */}
            <div className="space-y-6">
                <WeekChart days={days} />

                {/* Rules Card */}
                <div className="bg-slate-900 text-slate-300 p-6 rounded-xl text-sm leading-relaxed">
                    <h3 className="text-white font-bold mb-3 text-base">Policy Rules</h3>
                    <ul className="space-y-2">
                         <li className="flex gap-2">
                            <span className="text-blue-400 font-bold">•</span>
                            <span>Target: <b className="text-white">47.5h/week</b></span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-blue-400 font-bold">•</span>
                            <span>Half-Day Leave: <b className="text-purple-300">-4.75h</b> credit</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-blue-400 font-bold">•</span>
                            <span>Max Out: <b className="text-white">8:31 PM</b> (Strict)</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-blue-400 font-bold">•</span>
                            <span>Late Threshold: <b className="text-red-300">11:00 AM</b></span>
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
      </main>
    </div>
  );
}

export default App;