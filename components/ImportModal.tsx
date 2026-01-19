import React, { useState, useEffect } from 'react';
import { X, Clipboard, ExternalLink, CheckCircle2, AlertCircle, Bookmark, ClipboardCheck, ArrowRight, Table } from 'lucide-react';
import { DayLog, UserSettings } from '../types';
import { parseKekaText } from '../services/kekaParser';

interface Props {
  currentDays: DayLog[];
  settings: UserSettings;
  onImport: (updatedDays: DayLog[]) => void;
  onClose: () => void;
}

const ImportModal: React.FC<Props> = ({ currentDays, settings, onImport, onClose }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const processText = (input: string) => {
     if (!input.trim()) {
      setError('Text is empty.');
      return;
    }

    try {
      const updated = parseKekaText(input, currentDays, settings);
      
      // Validation: Did anything change?
      const hasChanges = updated.some((day, idx) => 
        day.punchIn !== currentDays[idx].punchIn || 
        day.punchOut !== currentDays[idx].punchOut ||
        day.grossHours !== currentDays[idx].grossHours ||
        day.leaveType !== currentDays[idx].leaveType
      );

      if (!hasChanges) {
        setError('No new data recognized. Ensure you copied the row text containing "Mon/Tue", "Gross Hours" (e.g. 7h 30m), or "Late" status.');
        return;
      }

      onImport(updated);
      onClose();
    } catch (e) {
      setError('Failed to parse text. Please try copying the table row again.');
    }
  }

  const handlePaste = async () => {
      try {
          const clipboardText = await navigator.clipboard.readText();
          setText(clipboardText);
          processText(clipboardText);
      } catch (err) {
          setError('Permission denied. Please paste manually below.');
      }
  };

  const KEKA_URL = "https://xbyte.keka.com/#/me/attendance/logs";
  const bookmarkletCode = `javascript:(function(){var t=document.body.innerText;var u='${origin}/?keka_import='+encodeURIComponent(t);window.open(u,'_blank');})();`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col md:flex-row max-h-[90vh] md:h-auto overflow-y-auto">
        
        {/* Left Side: Workflow */}
        <div className="flex-1 flex flex-col border-r border-slate-100 bg-slate-50">
             <div className="p-4 border-b border-slate-100 bg-white">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                    Sync Attendance
                </h3>
            </div>
            <div className="p-6 flex-1 flex flex-col space-y-6">
                
                {/* Step 1 */}
                <div className="relative pl-4 border-l-2 border-slate-200">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 flex items-center justify-center">1</div>
                    <h4 className="font-bold text-sm text-slate-700">Open Keka</h4>
                    <a 
                        href={KEKA_URL} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                    >
                        Open xbyte.keka.com <ExternalLink className="w-3 h-3" />
                    </a>
                </div>

                {/* Step 2 */}
                <div className="relative pl-4 border-l-2 border-slate-200">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 flex items-center justify-center">2</div>
                    <h4 className="font-bold text-sm text-slate-700">Copy Table Rows</h4>
                    <p className="text-xs text-slate-500 mb-2">
                        You do <b>not</b> need to open tooltips!
                    </p>
                    <div className="bg-slate-200/50 p-2 rounded border border-slate-300/50 flex items-center gap-2 text-[10px] text-slate-600 italic">
                        <Table className="w-3 h-3" />
                        Just select the table rows (Date, Gross Hours, Status) and Copy.
                    </div>
                </div>

                {/* Step 3 */}
                <div className="relative pl-4 border-l-2 border-indigo-500">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-600 text-[10px] font-bold text-white flex items-center justify-center">3</div>
                    <h4 className="font-bold text-sm text-indigo-900">Import</h4>
                    <button 
                        onClick={handlePaste}
                        className="mt-2 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        <Clipboard className="w-4 h-4" />
                        Paste from Clipboard
                    </button>
                    {error && (
                        <div className="mt-2 text-[10px] text-red-600 bg-red-50 p-2 rounded-lg flex gap-1 items-start">
                            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" /> 
                            <span className="flex-1 leading-tight">{error}</span>
                        </div>
                    )}
                </div>

            </div>
        </div>

        {/* Right Side: Manual / Advanced */}
        <div className="flex-1 flex flex-col bg-white">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-400 text-xs uppercase tracking-wider">
                    Manual / Alternate
                </h3>
                <button onClick={onClose} className="md:hidden p-1 text-slate-400">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="p-6 flex-1 flex flex-col">
                 <textarea 
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        setError('');
                    }}
                    placeholder="Paste text manually here if the button fails..."
                    className="w-full flex-1 min-h-[100px] p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono resize-none mb-3"
                 />
                 
                 <button 
                    onClick={() => processText(text)}
                    className="w-full py-2 mb-6 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                 >
                    Process Manual Text
                 </button>

                 <div className="mt-auto pt-6 border-t border-slate-100">
                     <div className="flex items-center gap-2 mb-2">
                        <Bookmark className="w-3 h-3 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-700">Extension Mode</span>
                     </div>
                     <p className="text-[10px] text-slate-400 mb-2">
                         Drag this button to your Bookmarks Bar. Click it while on the Keka page to sync without copying.
                     </p>
                     <a 
                        href={bookmarkletCode}
                        onClick={(e) => e.preventDefault()}
                        className="block w-full py-2 px-3 text-center border border-emerald-500 border-dashed text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-50 cursor-grab active:cursor-grabbing"
                     >
                        Sync Button
                     </a>
                 </div>
            </div>

             {/* Footer Mobile Close */}
            <div className="p-4 md:hidden">
                <button onClick={onClose} className="w-full py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg">
                    Close
                </button>
            </div>
        </div>
        
        {/* Desktop Close Button */}
        <button onClick={onClose} className="hidden md:block absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
             <X className="w-5 h-5" />
        </button>

      </div>
    </div>
  );
};

export default ImportModal;