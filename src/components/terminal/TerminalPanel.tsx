import { useState, useEffect } from 'react';
import { Terminal } from './Terminal';
import { TerminalSettings } from './TerminalSettings';
import { Button } from '@/components/ui/Button';
import { Settings, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { TerminalConfig } from './Terminal';

export interface TerminalPanelProps {
  className?: string;
  defaultConfig?: TerminalConfig;
  welcomeMessage?: string;
  prompt?: string;
  onCommand?: (command: string) => void;
  onOutput?: (output: string) => void;
}

export function TerminalPanel({
  className,
  defaultConfig,
  welcomeMessage = 'Welcome to Terminal\nType commands below:',
  prompt = '$ ',
  onCommand,
  onOutput,
}: TerminalPanelProps) {
  const [config, setConfig] = useState<TerminalConfig>(defaultConfig || {});
  const [showSettings, setShowSettings] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [terminalInstance, setTerminalInstance] = useState<any>(null);

  const handleCommand = (command: string) => {
    if (onCommand) {
      onCommand(command);
    } else {
      // Default command handling
      if (terminalInstance) {
        const output = `Command executed: ${command}`;
        terminalInstance.writeln(output);
        terminalInstance.write(prompt);
        if (onOutput) {
          onOutput(output);
        }
      }
    }
  };

  const writeOutput = (text: string) => {
    if (terminalInstance) {
      terminalInstance.writeln(text);
      terminalInstance.write(prompt);
    }
  };

  // Expose writeOutput method (you can call this from parent)
  useEffect(() => {
    if (terminalInstance) {
      (terminalInstance as any).writeOutput = writeOutput;
    }
  }, [terminalInstance]);

  return (
    <div className={cn('flex flex-col border-t border-border bg-background', className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Terminal</span>
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            aria-label={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showSettings && (
        <div className="border-b border-border max-h-96 overflow-auto">
          <TerminalSettings
            config={config}
            onConfigChange={setConfig}
            onClose={() => setShowSettings(false)}
          />
        </div>
      )}

      {!isMinimized && (
        <div className="flex-1 min-h-0">
          <Terminal
            config={config}
            welcomeMessage={welcomeMessage}
            prompt={prompt}
            onReady={setTerminalInstance}
            onData={handleCommand}
            className="h-full"
          />
        </div>
      )}
    </div>
  );
}
