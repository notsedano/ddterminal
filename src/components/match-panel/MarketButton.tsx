import React from 'react';
import { cn } from '@/utils/cn';

interface MarketButtonProps {
  name: string;
  percentage: string;
  odds: string;
  isHigher: boolean;
  href?: string;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'rainbow' | 'gold';
  size?: 'default' | 'small';
}

export const MarketButton: React.FC<MarketButtonProps> = ({ 
  name, 
  percentage, 
  odds, 
  isHigher,
  href,
  className,
  onClick,
  disabled = false,
  variant = 'rainbow',
  size = 'default'
}) => {
  const textSizeClass = size === 'small' ? 'text-[8px]' : 'text-[10px]';
  const percentageSizeClass = size === 'small' ? 'text-sm' : 'text-lg';
  
  const content = (
    <>
      <span className={cn(textSizeClass, 'text-muted-foreground truncate max-w-full leading-tight')}>
        {name}
      </span>
      {percentage && (
        <span className={cn(
          percentageSizeClass,
          'font-bold hud-data leading-tight',
          isHigher ? 'text-green-400' : 'text-red-400'
        )}>
          {percentage}
        </span>
      )}
      {odds && (
        <span className={cn(textSizeClass, 'text-muted-foreground hud-data leading-tight')}>
          {odds}
        </span>
      )}
    </>
  );

  const borderClass = variant === 'gold' 
    ? 'gold-border gold-border-no-glow' 
    : 'rainbow-border rainbow-border-no-glow';
  
  const sizeClasses = size === 'small' 
    ? 'w-[98px] h-[48px] text-[8px] px-2' 
    : 'w-[140px] h-[68px] px-3';
  
  const buttonStyles = cn(
    borderClass,
    sizeClasses,
    'relative flex flex-col items-center justify-center gap-0.5 rounded-xl border-none text-white font-black transition-all duration-200 bg-black/80',
    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90',
    onClick && !disabled && 'hover:scale-105 active:scale-95'
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
          onClick={onClick}
          disabled={disabled}
        >
          {content}
        </button>
      )}
    </div>
  );
};
