import React from 'react';
import { cn } from '@/utils/cn';

interface MarketButtonProps {
  name: string;
  percentage: string;
  odds: string;
  isHigher: boolean;
  href?: string;
  className?: string;
}

export const MarketButton: React.FC<MarketButtonProps> = ({ 
  name, 
  percentage, 
  odds, 
  isHigher,
  href,
  className 
}) => {
  const content = (
    <>
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
    </>
  );

  const buttonStyles = cn(
    'rainbow-border rainbow-border-no-glow relative w-[140px] h-[94px] flex flex-col items-center justify-center gap-1 px-4 rounded-xl border-none text-white cursor-pointer font-black transition-all duration-200 bg-black/80'
  );

  return (
    <div className={cn('relative', className)}>
      {href ? (
        <a 
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonStyles}
        >
          {content}
        </a>
      ) : (
        <button 
          className={buttonStyles}
        >
          {content}
        </button>
      )}
    </div>
  );
};
