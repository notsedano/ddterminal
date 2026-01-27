import { cn } from '@/utils/cn';

interface ShinyButtonProps {
  name: string;
  percentage: string;
  odds: string;
  href?: string;
  className?: string;
  onClick?: () => void;
}

export function ShinyButton({ 
  name, 
  percentage, 
  odds, 
  href,
  className,
  onClick 
}: ShinyButtonProps) {
  const content = (
    <span className="flex flex-col items-center justify-center gap-0.5 w-full">
      <span className="text-[10px] text-muted-foreground truncate max-w-full leading-tight">
        {name}
      </span>
      <span className="text-lg font-bold hud-data text-red-400 leading-tight">
        {percentage}
      </span>
      <span className="text-[10px] text-muted-foreground hud-data leading-tight">
        {odds}
      </span>
    </span>
  );

  return (
    <div className={cn('relative', className)}>
      {href ? (
        <a 
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="shiny-cta"
        >
          {content}
        </a>
      ) : (
        <button className="shiny-cta" onClick={onClick}>
          {content}
        </button>
      )}
    </div>
  );
}
