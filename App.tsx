import React, { useState, useEffect } from 'react';
import { Briefcase, Download, Share, X, Settings, Save, LayoutGrid, Calculator } from 'lucide-react';

import WeeklyDashboard from './components/WeeklyDashboard';
import QuickCalculator from './components/QuickCalculator';
import { UserSettings } from './types';

const DEFAULT_SETTINGS: UserSettings = {
  standardInTime: "10:30",
  maxOutTime: "20:31",
  enableMaxTime: true,
  lateBufferMinutes: 30
};

type ViewMode = 'weekly' | 'calculator';

function App() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosInstall, setShowIosInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  
  // Load settings from local storage or default
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('worksync_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // Save settings to local storage when changed
  useEffect(() => {
    localStorage.setItem('worksync_settings', JSON.stringify(settings));
  }, [settings]);

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

  return (
    <div className="min-h-screen bg-slate-50 pb-20 relative">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
                <Briefcase className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden sm:block">WorkSync</h1>
          </div>
          
          {/* View Switcher - Center */}
          <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1">
             <button 
               onClick={() => setViewMode('weekly')}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'weekly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <LayoutGrid className="w-3.5 h-3.5" />
                Tracker
             </button>
             <button 
               onClick={() => setViewMode('calculator')}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'calculator' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <Calculator className="w-3.5 h-3.5" />
                Calc
             </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
             {!isStandalone && (
               <button 
                  onClick={handleInstallClick}
                  className="flex items-center gap-2 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
               >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Install</span>
               </button>
             )}
             
             <button 
                onClick={() => setShowSettings(true)}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                title="Settings"
             >
                <Settings className="w-5 h-5" />
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

      <main className="max-w-5xl mx-auto px-4 py-8">
         {viewMode === 'weekly' ? (
            <WeeklyDashboard settings={settings} />
         ) : (
            <QuickCalculator settings={settings} />
         )}
      </main>
    </div>
  );
}

export default App;