import React, { useState, useEffect } from 'react';
import { X, Clipboard, ArrowRight, CheckCircle2, AlertCircle, Bookmark, MoveRight } from 'lucide-react';
import { DayLog } from '../types';
import { parseKekaText } from '../services/kekaParser';

interface Props {
  currentDays: DayLog[];
  onImport: (updatedDays: DayLog[]) => void;
  onClose: () => void;
}

const ImportModal: React.FC<Props> = ({ currentDays, onImport, onClose }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const handleProcess = () => {
    if (!text.trim()) {
      setError('Please paste some text first.');
      return;
    }

    try {
      const updated = parseKekaText(text, currentDays);
      const hasChanges = updated.some((day, idx) => 
        day.punchIn !== currentDays[idx].punchIn || day.punchOut !== currentDays[idx].punchOut
      );

      if (!hasChanges) {
        setError('No valid time data found. Ensure text contains Day Names (Mon, Tue) and Times (09:30).');
        return;
      }

      onImport(updated);
      onClose();
    } catch (e) {
      setError('Failed to parse text.');
    }
  };

  // The Magic Script: It scrapes Keka and sends data back to this app
  const bookmarkletCode = `javascript:(function(){var t=document.body.innerText;var u='${origin}/?keka_import='+encodeURIComponent(t);window.open(u,'_blank');})();`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col md:flex-row">
        
        {/* Left Side: Manual Paste */}
        <div className="flex-1 flex flex-col border-r border-slate-100">
             <div className="p-4 border-b border-slate-100 bg-indigo-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Clipboard className="w-5 h-5 text-indigo-600" />
                    Manual Import
                </h3>
            </div>
            <div className="p-6 flex-1 flex flex-col">
                <p className="text-xs text-slate-500 mb-3">
                    Select your Keka table, <b>Copy (Ctrl+C)</b>, and paste here.
                </p>
                <textarea 
                    value={text}
                    onChange={(e) => {
                    setText(e.target.value);
                    setError('');
                    }}
                    placeholder="Paste copied text here..."
                    className="w-full flex-1 min-h-[120px] p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono resize-none mb-3"
                />
                {error && (
                    <div className="mb-3 text-xs text-red-600 bg-red-50 p-2 rounded-lg flex gap-1">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" /> {error}
                    </div>
                )}
                <button 
                    onClick={handleProcess}
                    className="w-full py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all"
                >
                    Process Data
                </button>
            </div>
        </div>

        {/* Right Side: Smart Bookmark */}
        <div className="flex-1 flex flex-col bg-slate-50/50">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Bookmark className="w-5 h-5 text-emerald-600" />
                    Smart Bookmark
                </h3>
                <button onClick={onClose} className="md:hidden p-1 text-slate-400">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="p-6 flex-1 flex flex-col items-center text-center justify-center space-y-4">
                 <div className="bg-emerald-100 p-3 rounded-full mb-2">
                     <MoveRight className="w-6 h-6 text-emerald-600" />
                 </div>
                 
                 <div>
                    <h4 className="font-bold text-slate-800 text-sm">One-Click Sync</h4>
                    <p className="text-xs text-slate-500 mt-1 px-4">
                        Drag the button below to your <b>Bookmarks Bar</b>.
                    </p>
                 </div>

                 <a 
                    href={bookmarkletCode}
                    onClick={(e) => e.preventDefault()}
                    className="block w-full py-3 px-4 bg-white border-2 border-emerald-500 border-dashed text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-50 cursor-grab active:cursor-grabbing shadow-sm"
                    title="Drag this to your bookmarks bar"
                 >
                    Sync to WorkSync ⚡
                 </a>

                 <div className="text-[10px] text-slate-400 bg-slate-100 p-3 rounded-lg text-left w-full">
                     <b>How to use:</b>
                     <ol className="list-decimal ml-3 mt-1 space-y-1">
                         <li>Go to Keka Attendance page.</li>
                         <li>Click the <b>"Sync to WorkSync"</b> bookmark you just added.</li>
                         <li>Magic happens! 🪄</li>
                     </ol>
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