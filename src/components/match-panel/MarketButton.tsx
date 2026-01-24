import React from 'react';
import { cn } from '@/utils/cn';

interface MarketButtonProps {
  name: string;
  percentage: string;
  odds: string;
  isHigher: boolean;
  className?: string;
}

export const MarketButton: React.FC<MarketButtonProps> = ({ 
  name, 
  percentage, 
  odds, 
  isHigher,
  className 
}) => {
  return (
    <div className={cn('relative', className)}>
      <button 
        className={cn(
          'rainbow-border relative w-[140px] h-[94px] flex flex-col items-center justify-center gap-1 px-4 rounded-xl border-none text-white cursor-pointer font-black transition-all duration-200',
          isHigher 
            ? 'bg-black/80' 
            : 'bg-black/80'
        )}
        style={{
          backgroundColor: isHigher 
            ? 'rgba(0, 0, 0, 0.8)' 
            : 'rgba(0, 0, 0, 0.8)',
          boxShadow: isHigher
            ? 'inset 0 0 20px rgba(34, 197, 94, 0.06), 0 0 10px rgba(34, 197, 94, 0.03)'
            : 'inset 0 0 20px rgba(239, 68, 68, 0.06), 0 0 10px rgba(239, 68, 68, 0.03)'
        }}
      >
        <span className="text-xs text-muted-foreground truncate max-w-full">
          {name}
        </span>
        <span className={cn(
          'text-xl font-bold hud-data',
          isHigher ? 'text-green-400' : 'text-red-400'
        )}>
          {percentage}
        </span>
        <span className="text-xs text-muted-foreground hud-data">
          {odds}
        </span>
      </button>
    </div>
  );
};
