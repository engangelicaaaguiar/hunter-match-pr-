
import React from 'react';

interface GaugeChartProps {
  score: number;
  label: string;
  size?: number;
  color?: string;
}

const GaugeChart: React.FC<GaugeChartProps> = ({ 
  score, 
  label, 
  size = 120, 
  color = "#60a5fa" 
}) => {
  const radius = (size / 2) - 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1e293b"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-2xl font-bold">{score}</span>
        </div>
      </div>
      <span className="mt-2 text-sm font-medium text-slate-400">{label}</span>
    </div>
  );
};

export default GaugeChart;
