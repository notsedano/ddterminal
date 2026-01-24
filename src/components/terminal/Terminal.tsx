import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { cn } from '@/utils/cn';

export interface TerminalTheme {
  background?: string;
  foreground?: string;
  cursor?: string;
  selection?: string;
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;
  brightBlack?: string;
  brightRed?: string;
  brightGreen?: string;
  brightYellow?: string;
  brightBlue?: string;
  brightMagenta?: string;
  brightCyan?: string;
  brightWhite?: string;
}

export interface TerminalConfig {
  fontSize?: number;
  fontFamily?: string;
  theme?: TerminalTheme;
  cursorBlink?: boolean;
  cursorStyle?: 'block' | 'underline' | 'bar';
  lineHeight?: number;
  letterSpacing?: number;
}

export interface TerminalProps {
  className?: string;
  config?: TerminalConfig;
  onReady?: (terminal: XTerm) => void;
  onData?: (data: string) => void;
  welcomeMessage?: string;
  prompt?: string;
}

const defaultTheme: TerminalTheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#aeafad',
  selection: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
};

export function Terminal({
  className,
  config = {},
  onReady,
  onData,
  welcomeMessage,
  prompt = '$ ',
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isReady, setIsReady] = useState(false);

  const {
    fontSize = 14,
    fontFamily = 'Consolas, "Courier New", monospace',
    theme = defaultTheme,
    cursorBlink = true,
    cursorStyle = 'block',
    lineHeight = 1.2,
    letterSpacing = 0,
  } = config;

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const terminal = new XTerm({
      fontSize,
      fontFamily,
      theme,
      cursorBlink,
      cursorStyle,
      lineHeight,
      letterSpacing,
      allowProposedApi: true,
    });

    // Create and load addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // Open terminal
    terminal.open(terminalRef.current);

    // Fit to container
    fitAddon.fit();

    // Store refs
    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Write welcome message
    if (welcomeMessage) {
      terminal.writeln(welcomeMessage);
    }
    terminal.write(prompt);

    // Handle input
    let currentLine = '';
    terminal.onData((data) => {
      if (data === '\r' || data === '\n') {
        // Enter pressed
        terminal.write('\r\n');
        if (onData) {
          onData(currentLine);
        }
        currentLine = '';
        terminal.write(prompt);
      } else if (data === '\x7f' || data === '\b') {
        // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          terminal.write('\b \b');
        }
      } else if (data === '\x03') {
        // Ctrl+C
        terminal.write('^C\r\n');
        currentLine = '';
        terminal.write(prompt);
      } else if (data >= ' ') {
        // Printable character
        currentLine += data;
        terminal.write(data);
      }
    });

    setIsReady(true);
    if (onReady) {
      onReady(terminal);
    }

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, []);

  // Update config when it changes
  useEffect(() => {
    if (!terminalInstanceRef.current || !isReady) return;

    const terminal = terminalInstanceRef.current;
    terminal.options.fontSize = fontSize;
    terminal.options.fontFamily = fontFamily;
    terminal.options.theme = theme;
    terminal.options.cursorBlink = cursorBlink;
    terminal.options.cursorStyle = cursorStyle;
    terminal.options.lineHeight = lineHeight;
    terminal.options.letterSpacing = letterSpacing;

    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [fontSize, fontFamily, theme, cursorBlink, cursorStyle, lineHeight, letterSpacing, isReady]);

  return (
    <div className={cn('h-full w-full bg-[#1e1e1e] p-2', className)}>
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
}
