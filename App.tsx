import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Briefcase, AlertTriangle, RefreshCw, Calendar, CheckCircle2, Download, Share, X, Settings, Save } from 'lucide-react';

import DayRow from './components/DayRow';
import WeekChart from './components/WeekChart';
import { DayLog, WeekStats, UserSettings } from './types';
import { WEEK_DAYS, WEEKLY_TARGET_HOURS } from './constants';
import { calculateDuration, calculateWeekStats, decimalToDuration, distributeDeficit, getSmartSuggestions } from './services/timeUtils';

const DEFAULT_SETTINGS: UserSettings = {
  standardInTime: "10:30",
  maxOutTime: "20:31",
  enableMaxTime: true,
  lateBufferMinutes: 30
};

function App() {
  const [currentDate] = useState(new Date());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosInstall, setShowIosInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Load settings from local storage or default
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('worksync_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // Save settings to local storage when changed
  useEffect(() => {
    localStorage.setItem('worksync_settings', JSON.stringify(settings));
  }, [settings]);

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
    // Check if running in standalone mode
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(checkStandalone);

    // Android/Desktop Prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    // If we have the native prompt (Android/Desktop), use it
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // Otherwise show the "How to" modal (iOS or unsupported browsers)
      setShowIosInstall(true);
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
    const updatedDays = distributeDeficit(days, settings);
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
             {!isStandalone && (
               <button 
                  onClick={handleInstallClick}
                  className="flex items-center gap-2 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
               >
                  <Download className="w-4 h-4" />
                  <span>Install</span>
               </button>
             )}
             
             <button 
                onClick={() => setShowSettings(true)}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                title="Settings"
             >
                <Settings className="w-5 h-5" />
             </button>

             <button 
                onClick={handleAutoPlan}
                className="hidden md:flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-slate-200"
            >
                <RefreshCw className="w-4 h-4" />
                <span>Auto-Plan</span>
             </button>
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <Settings className="w-5 h-5" />
                   Preferences
                </h3>
                <button onClick={() => setShowSettings(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                 
                 {/* Standard In Time */}
                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Standard In Time</label>
                    <p className="text-xs text-slate-500 mb-2">Used to auto-fill punch-in and calculate late status.</p>
                    <input 
                      type="time" 
                      value={settings.standardInTime}
                      onChange={(e) => setSettings({...settings, standardInTime: e.target.value})}
                      className="w-full p-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      style={{ colorScheme: 'dark' }}
                    />
                 </div>

                 {/* Late Threshold Display */}
                 <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                    <div className="flex items-center gap-2 text-orange-800 text-sm font-medium">
                       <AlertTriangle className="w-4 h-4" />
                       <span>Late Threshold</span>
                    </div>
                    <p className="text-xs text-orange-700 mt-1">
                       You will be marked late if you punch in after <b>{
                         // Simple logic to show user standard + 30m without complex import
                         (() => {
                            const [h, m] = settings.standardInTime.split(':').map(Number);
                            const total = h * 60 + m + settings.lateBufferMinutes;
                            const h2 = Math.floor(total / 60);
                            const m2 = total % 60;
                            return `${h2.toString().padStart(2,'0')}:${m2.toString().padStart(2,'0')}`;
                         })()
                       }</b> (+{settings.lateBufferMinutes}m).
                    </p>
                 </div>

                 {/* Max Out Time Toggle */}
                 <div className="border-t border-slate-100 pt-4">
                     <div className="flex items-center justify-between mb-4">
                        <div>
                           <label className="block text-sm font-semibold text-slate-700">Max Out Restriction</label>
                           <p className="text-xs text-slate-500">Cap punch-out time automatically.</p>
                        </div>
                        <button 
                           onClick={() => setSettings({...settings, enableMaxTime: !settings.enableMaxTime})}
                           className={`w-12 h-6 rounded-full transition-colors relative ${settings.enableMaxTime ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                           <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.enableMaxTime ? 'left-7' : 'left-1'}`} />
                        </button>
                     </div>

                     {settings.enableMaxTime && (
                        <div className="animate-in slide-in-from-top-2">
                           <label className="block text-sm font-semibold text-slate-700 mb-1">Max Allowed Out Time</label>
                           <input 
                              type="time" 
                              value={settings.maxOutTime}
                              onChange={(e) => setSettings({...settings, maxOutTime: e.target.value})}
                              className="w-full p-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                              style={{ colorScheme: 'dark' }}
                           />
                        </div>
                     )}
                 </div>
              </div>
              
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                 <button 
                   onClick={() => setShowSettings(false)}
                   className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 flex items-center gap-2"
                 >
                   <Save className="w-4 h-4" />
                   Done
                 </button>
              </div>
           </div>
        </div>
      )}

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

        {/* Mobile Auto Plan Button */}
        <div className="md:hidden">
             <button 
                onClick={handleAutoPlan}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-slate-200"
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
      </main>
    </div>
  );
}

export default App;