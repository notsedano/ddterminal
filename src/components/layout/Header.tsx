import { Moon, Sun, Terminal as TerminalIcon, Tv } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getTheme, setTheme } from '@/utils/storage';
import { useState, useEffect } from 'react';
import { cn } from '@/utils/cn';

import logo from '@assets/Full Color@10x.png';

export interface HeaderProps {
  showTerminal?: boolean;
  onToggleTerminal?: () => void;
  showMatchPanel?: boolean;
  onToggleMatchPanel?: () => void;
  hasLiveGames?: boolean;
}

export function Header({ 
  showTerminal, 
  onToggleTerminal,
  showMatchPanel,
  onToggleMatchPanel,
  hasLiveGames,
}: HeaderProps = {}) {
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const currentTheme = getTheme();
    setThemeState(currentTheme);
    setTheme(currentTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setThemeState(newTheme);
    setTheme(newTheme);
  };

  return (
    <header className="hud-border border-b bg-background h-[65px] flex shrink-0 relative z-20">
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        <div className="flex items-center shrink-0 min-w-0 gap-4">
          <img
            src={logo}
            alt="Agent Daredevil — A.I. · Sports · Gaming · NPC"
            className="h-10 sm:h-11 md:h-12 w-auto max-h-full object-contain object-left"
          />
          <div className="flex flex-col justify-center">
            <div className="text-white text-base sm:text-lg font-normal">
              //DARE TERMINAL
            </div>
            <div className="text-white text-xs sm:text-sm border border-yellow-400 px-2 py-0.5 mt-1 inline-block">
              early access testnet v.0.1
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {onToggleMatchPanel && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleMatchPanel}
              aria-label="Toggle match panel"
              className={cn(
                'hidden md:flex relative',
                showMatchPanel && 'bg-accent'
              )}
            >
              <Tv className="h-5 w-5" />
              {hasLiveGames && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              )}
            </Button>
          )}
          {onToggleTerminal && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTerminal}
              aria-label="Toggle terminal"
              className={cn(showTerminal && 'bg-accent')}
            >
              <TerminalIcon className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
