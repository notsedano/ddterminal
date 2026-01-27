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
      <span className="text-[10px] text-muted-foreground truncate max-w-full leading-tight">
        {name}
      </span>
      <span className={cn(
        'text-lg font-bold hud-data leading-tight',
        isHigher ? 'text-green-400' : 'text-red-400'
      )}>
        {percentage}
      </span>
      <span className="text-[10px] text-muted-foreground hud-data leading-tight">
        {odds}
      </span>
    </>
  );

  const buttonStyles = cn(
    'rainbow-border rainbow-border-no-glow relative w-[140px] h-[68px] flex flex-col items-center justify-center gap-0.5 px-3 rounded-xl border-none text-white cursor-pointer font-black transition-all duration-200 bg-black/80'
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
