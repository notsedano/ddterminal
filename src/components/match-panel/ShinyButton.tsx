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
    <span className="flex flex-col items-center justify-center gap-1 w-full">
      <span className="text-xs text-muted-foreground truncate max-w-full">
        {name}
      </span>
      <span className="text-xl font-bold hud-data text-red-400">
        {percentage}
      </span>
      <span className="text-xs text-muted-foreground hud-data">
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
