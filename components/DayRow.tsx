import React, { useMemo } from 'react';
import { Clock, AlertCircle, CheckCircle, ChevronDown, RotateCcw } from 'lucide-react';
import { DayLog, LeaveType, DaySuggestions, SuggestionResult } from '../types';
import { LATE_THRESHOLD, MAX_PUNCH_OUT_TIME, DAILY_TARGET_HOURS } from '../constants';
import { decimalToDuration, getDailyExpectation } from '../services/timeUtils';

interface Props {
  day: DayLog;
  onUpdate: (id: string, field: keyof DayLog, value: any) => void;
  onReset: (id: string) => void;
  suggestions: DaySuggestions;
}

const SuggestionPill: React.FC<{ 
  label: string; 
  data: SuggestionResult; 
  onClick: () => void;
  variant: 'std' | 'adj';
}> = ({ label, data, onClick, variant }) => {
  if (data.status === 'none') return null;

  const isImpossible = data.status === 'impossible';
  
  // Color styling
  const baseClasses = "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all border";
  
  let colorClasses = "";
  if (isImpossible) {
    colorClasses = "bg-red-50 border-red-200 text-red-600 hover:bg-red-100";
  } else if (variant === 'std') {
    colorClasses = "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200";
  } else {
    colorClasses = "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100";
  }

  return (
    <button onClick={onClick} className={`${baseClasses} ${colorClasses}`} title={data.msg}>
      <span>{label}</span>
      <span className="font-mono text-xs">{data.time}</span>
    </button>
  );
};

const DayRow: React.FC<Props> = ({ day, onUpdate, onReset, suggestions }) => {
  
  const isLate = useMemo(() => {
    if (!day.punchIn) return false;
    return day.punchIn > LATE_THRESHOLD;
  }, [day.punchIn]);

  const dailyTarget = getDailyExpectation(day.leaveType);
  const isMet = day.grossHours >= dailyTarget && dailyTarget > 0;
  
  const progressColor = useMemo(() => {
    if (day.leaveType === 'FULL') return 'bg-slate-100 border-slate-200 opacity-60';
    if (day.leaveType === 'HALF') return 'bg-purple-50 border-purple-200';
    if (isMet) return 'bg-emerald-50 border-emerald-200';
    if (day.grossHours > 0) return 'bg-white border-slate-200';
    return 'bg-slate-50 border-slate-200 opacity-70';
  }, [day.grossHours, day.leaveType, isMet]);

  const isDisabled = day.leaveType === 'FULL';
  const showSuggestions = !isDisabled && !day.punchOut && day.punchIn && suggestions.standard.status !== 'none';
  const hasData = day.punchIn || day.punchOut;

  return (
    <div className={`relative flex flex-col md:flex-row gap-4 p-4 rounded-xl border ${progressColor} transition-all duration-200`}>
      {/* Date & Label */}
      <div className="flex-shrink-0 w-32 flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-sm">{day.label}</span>
          {day.isToday && <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-600 rounded-full">TODAY</span>}
        </div>
        <span className="text-xs text-slate-400">{day.dateStr}</span>
      </div>

      {/* Controls */}
      <div className="flex-grow grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
        
        {/* Leave Selector */}
        <div className="relative group">
           <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Status</label>
           <div className="relative">
             <select 
               value={day.leaveType}
               onChange={(e) => onUpdate(day.id, 'leaveType', e.target.value as LeaveType)}
               className="w-full p-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-200 outline-none appearance-none cursor-pointer"
             >
               <option value="NONE">Working Day</option>
               <option value="HALF">Half-Day Leave</option>
               <option value="FULL">Full-Day Leave</option>
             </select>
             <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
           </div>
        </div>

        {/* Punch In */}
        <div className="relative group">
          <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Punch In</label>
          <div className="relative">
            <input 
              type="time" 
              value={day.punchIn}
              disabled={isDisabled}
              onChange={(e) => onUpdate(day.id, 'punchIn', e.target.value)}
              className={`w-full p-2 text-sm bg-white border rounded-lg focus:ring-2 focus:ring-blue-200 outline-none font-mono disabled:bg-slate-50 disabled:text-slate-400
                ${isLate && !isDisabled ? 'border-red-300 text-red-600' : 'border-slate-200'}`}
            />
            {isLate && !isDisabled && (
               <AlertCircle className="absolute right-2 top-2.5 w-4 h-4 text-red-400" />
            )}
          </div>
          {isLate && !isDisabled && <span className="text-[10px] text-red-500 font-medium absolute -bottom-4 left-0">Late Entry</span>}
        </div>

        {/* Punch Out */}
        <div className="relative group">
           <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Punch Out</label>
           <div className="relative">
             <input 
              type="time" 
              value={day.punchOut}
              disabled={isDisabled}
              max={MAX_PUNCH_OUT_TIME}
              onChange={(e) => onUpdate(day.id, 'punchOut', e.target.value)}
              className={`w-full p-2 text-sm bg-white border rounded-lg focus:ring-2 focus:ring-blue-200 outline-none font-mono border-slate-200 disabled:bg-slate-50 disabled:text-slate-400`}
            />
             {isMet && (
               <CheckCircle className="absolute right-2 top-2.5 w-4 h-4 text-emerald-500" />
             )}
           </div>
           
           {/* Suggestions Container */}
           {showSuggestions && (
             <div className="absolute top-full left-0 mt-2 flex gap-2 z-10 animate-in fade-in slide-in-from-top-1">
               <SuggestionPill 
                 label="STD" 
                 data={suggestions.standard} 
                 variant="std"
                 onClick={() => onUpdate(day.id, 'punchOut', suggestions.standard.time)}
               />
               <SuggestionPill 
                 label="ADJ" 
                 data={suggestions.adjusted} 
                 variant="adj"
                 onClick={() => onUpdate(day.id, 'punchOut', suggestions.adjusted.time)}
               />
             </div>
           )}
        </div>

        {/* Stats & Reset */}
        <div className="flex items-center justify-between md:justify-start pl-2 border-l border-slate-200 gap-4">
             <div className="flex flex-col items-end md:items-start">
                <span className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Work Done</span>
                <span className={`text-lg font-bold font-mono ${isMet ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {decimalToDuration(day.grossHours)}
                </span>
                {day.leaveType === 'HALF' && (
                    <span className="text-[10px] text-purple-600 font-medium">+4.75h Credit</span>
                )}
             </div>
             
             {hasData && !isDisabled && (
                 <button 
                    onClick={() => onReset(day.id)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="Reset Day's Entry"
                 >
                    <RotateCcw className="w-4 h-4" />
                 </button>
             )}
        </div>
      </div>
    </div>
  );
};

export default DayRow;