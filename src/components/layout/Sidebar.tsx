import { Plus, Trash2, Puzzle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useSessions, useDeleteSession, useCreateSession } from '@/hooks/useSession';
import { PluginPanel } from '@/components/plugins/PluginPanel';
import { format } from 'date-fns';
import { cn } from '@/utils/cn';
import { useState } from 'react';
import type { Session } from '@/types';

export interface SidebarProps {
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  agentId: string;
}

export function Sidebar({ currentSessionId, onSessionSelect, agentId }: SidebarProps) {
  const { data: sessions = [], isLoading } = useSessions();
  const deleteSession = useDeleteSession();
  const createSession = useCreateSession();
  const [showPlugins, setShowPlugins] = useState(false);

  const handleNewSession = () => {
    createSession.mutate(
      { agentId },
      {
        onSuccess: (session) => {
          onSessionSelect(session.sessionId);
        },
      }
    );
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSession.mutate(sessionId);
    if (currentSessionId === sessionId) {
      const remaining = sessions.filter((s) => s.sessionId !== sessionId);
      if (remaining.length > 0) {
        onSessionSelect(remaining[0].sessionId);
      }
    }
  };

  return (
    <aside className="w-64 hud-panel border-r bg-background flex flex-col relative z-10">
      <div className="p-4 border-b border-border space-y-2 relative z-10">
        <Button onClick={handleNewSession} className="w-full" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Session
        </Button>
        <Button
          variant="outline"
          className="w-full"
          size="sm"
          onClick={() => setShowPlugins(!showPlugins)}
        >
          <Puzzle className="h-4 w-4 mr-2" />
          Plugins
          {showPlugins ? (
            <ChevronUp className="h-4 w-4 ml-auto" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-auto" />
          )}
        </Button>
      </div>
      {showPlugins && (
        <div className="border-b border-border p-4 max-h-[300px] overflow-auto">
          <PluginPanel agentId={agentId} />
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No sessions yet. Create one to get started.
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {sessions.map((session: Session) => (
              <div
                key={session.sessionId}
                onClick={() => onSessionSelect(session.sessionId)}
                className={cn(
                  'p-3 rounded-md cursor-pointer hover:bg-accent transition-colors',
                  currentSessionId === session.sessionId && 'bg-accent'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate hud-text">
                      {format(new Date(session.createdAt), 'MMM d, HH:mm')}
                    </div>
                    <div className="text-xs text-muted-foreground truncate hud-text-dim hud-data">
                      {session.channelId.slice(0, 8)}...
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => handleDeleteSession(session.sessionId, e)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
