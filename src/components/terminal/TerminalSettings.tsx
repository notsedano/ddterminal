import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import type { TerminalConfig, TerminalTheme } from './Terminal';

export interface TerminalSettingsProps {
  config: TerminalConfig;
  onConfigChange: (config: TerminalConfig) => void;
  onClose?: () => void;
}

const presetThemes: Record<string, TerminalTheme> = {
  dark: {
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
  },
  light: {
    background: '#ffffff',
    foreground: '#000000',
    cursor: '#000000',
    selection: '#add6ff',
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
    brightWhite: '#000000',
  },
  'dracula': {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    selection: '#44475a',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
  },
  'monokai': {
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    selection: '#49483e',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
  },
};

export function TerminalSettings({ config, onConfigChange, onClose }: TerminalSettingsProps) {
  const [localConfig, setLocalConfig] = useState<TerminalConfig>(config);

  const updateConfig = (updates: Partial<TerminalConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const applyPresetTheme = (themeName: string) => {
    const theme = presetThemes[themeName];
    if (theme) {
      updateConfig({ theme });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Terminal Settings</h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            ×
          </Button>
        )}
      </div>

      <Tabs defaultValue="appearance">
        <TabsList>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Font Size</label>
            <Input
              type="number"
              min="8"
              max="32"
              value={localConfig.fontSize || 14}
              onChange={(e) => updateConfig({ fontSize: parseInt(e.target.value) || 14 })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Font Family</label>
            <Input
              value={localConfig.fontFamily || 'Consolas, "Courier New", monospace'}
              onChange={(e) => updateConfig({ fontFamily: e.target.value })}
              placeholder="Consolas, 'Courier New', monospace"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Line Height</label>
            <Input
              type="number"
              min="0.5"
              max="3"
              step="0.1"
              value={localConfig.lineHeight || 1.2}
              onChange={(e) => updateConfig({ lineHeight: parseFloat(e.target.value) || 1.2 })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cursor Style</label>
            <select
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              value={localConfig.cursorStyle || 'block'}
              onChange={(e) => updateConfig({ cursorStyle: e.target.value as 'block' | 'underline' | 'bar' })}
            >
              <option value="block">Block</option>
              <option value="underline">Underline</option>
              <option value="bar">Bar</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="cursorBlink"
              checked={localConfig.cursorBlink !== false}
              onChange={(e) => updateConfig({ cursorBlink: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="cursorBlink" className="text-sm font-medium">
              Cursor Blink
            </label>
          </div>
        </TabsContent>

        <TabsContent value="theme" className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Preset Themes</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(presetThemes).map((themeName) => (
                <Button
                  key={themeName}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPresetTheme(themeName)}
                  className="capitalize"
                >
                  {themeName}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Background Color</label>
            <Input
              type="color"
              value={localConfig.theme?.background || '#1e1e1e'}
              onChange={(e) =>
                updateConfig({
                  theme: { ...localConfig.theme, background: e.target.value },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Foreground Color</label>
            <Input
              type="color"
              value={localConfig.theme?.foreground || '#d4d4d4'}
              onChange={(e) =>
                updateConfig({
                  theme: { ...localConfig.theme, foreground: e.target.value },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cursor Color</label>
            <Input
              type="color"
              value={localConfig.theme?.cursor || '#aeafad'}
              onChange={(e) =>
                updateConfig({
                  theme: { ...localConfig.theme, cursor: e.target.value },
                })
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Letter Spacing</label>
            <Input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={localConfig.letterSpacing || 0}
              onChange={(e) => updateConfig({ letterSpacing: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
