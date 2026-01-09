import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { DayLog } from '../types';
import { getDailyExpectation } from '../services/timeUtils';

interface Props {
  days: DayLog[];
}

const WeekChart: React.FC<Props> = ({ days }) => {
  const data = days.map(day => {
    const expectation = getDailyExpectation(day.leaveType);
    return {
      name: day.label.substring(0, 3),
      hours: day.grossHours,
      target: expectation,
      leaveType: day.leaveType
    };
  });

  return (
    <div className="h-64 w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-500 mb-4">Weekly Hours Distribution</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis hide domain={[0, 12]} />
          <Tooltip 
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => {
               // Determine color
               let color = '#3b82f6'; // Default blue
               if (entry.leaveType === 'FULL') color = '#cbd5e1'; // Grey for full leave
               else if (entry.hours >= entry.target && entry.target > 0) color = '#10b981'; // Green if met target
               else if (entry.leaveType === 'HALF') color = '#8b5cf6'; // Purple for half leave (working)
               
               return <Cell key={`cell-${index}`} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WeekChart;