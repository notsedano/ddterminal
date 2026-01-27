import { Plus, Trash2, Puzzle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useSessions, useDeleteSession, useCreateSession } from '@/hooks/useSession';
import { PluginPanel } from '@/components/plugins/PluginPanel';
import { format } from 'date-fns';
import { cn } from '@/utils/cn';
import { useState, useCallback } from 'react';
import type { Session, SessionMetadata } from '@/types';
import { LiveTeamStats } from '@/components/sidebar/LiveTeamStats';
import { clearAllData, debugListAllSessions } from '@/services/storage/conversationStorage';
import { useQueryClient } from '@tanstack/react-query';

export interface SidebarProps {
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  agentId: string;
}

/**
 * Get display title for a session
 * Uses matchup title if available, otherwise falls back to date/channel
 */
function getSessionTitle(session: Session): string {
  const metadata = session.metadata as SessionMetadata;
  if (metadata?.matchupTitle) {
    return metadata.matchupTitle;
  }
  return format(new Date(session.createdAt), 'MMM d, HH:mm');
}

/**
 * Get subtitle for a session
 */
function getSessionSubtitle(session: Session): string {
  const metadata = session.metadata as SessionMetadata;
  if (metadata?.matchupTitle) {
    // Show date if we have a matchup title
    return format(new Date(session.createdAt), 'MMM d, HH:mm');
  }
  // Show channel ID if no matchup title
  return session.channelId.slice(0, 8) + '...';
}

export function Sidebar({ currentSessionId, onSessionSelect, agentId }: SidebarProps) {
  const { data: sessions = [], isLoading, refetch } = useSessions();
  const deleteSession = useDeleteSession();
  const createSession = useCreateSession();
  const queryClient = useQueryClient();
  const [showPlugins, setShowPlugins] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    sessionId: string | null;
    sessionTitle: string;
  }>({ isOpen: false, sessionId: null, sessionTitle: '' });

  // Clear All confirmation state
  const [clearAllConfirm, setClearAllConfirm] = useState(false);

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

  // Debug: List all sessions in IndexedDB
  const handleDebug = useCallback(async () => {
    console.log('=== DEBUG: Checking all data sources ===');
    await debugListAllSessions();
    console.log('Current sessions from useSessions():', sessions);
    console.log('React Query cache:', queryClient.getQueryCache().getAll());
  }, [sessions, queryClient]);

  // Clear all local data and refresh
  const handleClearAll = useCallback(async () => {
    setIsClearing(true);
    try {
      console.log('[Sidebar] Clearing all local data...');
      
      // Clear IndexedDB (deletes both databases)
      await clearAllData();
      
      // Clear React Query cache
      queryClient.clear();
      
      // Clear localStorage items related to sessions
      localStorage.removeItem('eliza_user_id');
      
      console.log('[Sidebar] All local data cleared, reloading page...');
      setClearAllConfirm(false);
      
      // Force page reload to reset all state
      window.location.reload();
    } catch (error) {
      console.error('[Sidebar] Failed to clear data:', error);
      setIsClearing(false);
    }
  }, [queryClient]);

  const handleDeleteClick = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({
      isOpen: true,
      sessionId: session.sessionId,
      sessionTitle: getSessionTitle(session),
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm.sessionId) return;
    
    const sessionId = deleteConfirm.sessionId;
    const wasCurrentSession = currentSessionId === sessionId;
    
    deleteSession.mutate(sessionId, {
      onSuccess: () => {
        // If we deleted the current session, select another
        // Use the updated sessions list from React Query
        if (wasCurrentSession) {
          // Wait a tick for React Query to update, then select first remaining session
          setTimeout(() => {
            const updatedSessions = sessions.filter((s) => s.sessionId !== sessionId);
            if (updatedSessions.length > 0) {
              onSessionSelect(updatedSessions[0].sessionId);
            }
          }, 0);
        }
        setDeleteConfirm({ isOpen: false, sessionId: null, sessionTitle: '' });
      },
      onError: (error) => {
        console.error('[Sidebar] Failed to delete session:', error);
        setDeleteConfirm({ isOpen: false, sessionId: null, sessionTitle: '' });
      },
    });
  };

  const handleCancelDelete = () => {
    setDeleteConfirm({ isOpen: false, sessionId: null, sessionTitle: '' });
  };

  return (
    <aside className="w-64 hud-panel border-r bg-background flex flex-col relative z-10">
      <div className="p-4 border-b border-border space-y-2 relative z-10">
        <Button onClick={handleNewSession} className="w-full" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Session
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            title="Refresh sessions"
            className="h-8 w-8"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* Debug buttons - only in development */}
        {import.meta.env.DEV && (
          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDebug}
              className="flex-1 text-xs text-muted-foreground"
            >
              Debug
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setClearAllConfirm(true)}
              className="flex-1 text-xs text-destructive"
            >
              Clear All
            </Button>
          </div>
        )}
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
                      {getSessionTitle(session)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate hud-text-dim hud-data">
                      {getSessionSubtitle(session)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => handleDeleteClick(session, e)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <LiveTeamStats />
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Conversation"
        message={`Are you sure you want to delete "${deleteConfirm.sessionTitle}"? This conversation will be archived and can be recovered later.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={deleteSession.isPending}
      />

      {/* Clear All Confirmation Dialog */}
      <ConfirmDialog
        isOpen={clearAllConfirm}
        onClose={() => setClearAllConfirm(false)}
        onConfirm={handleClearAll}
        title="Clear All Local Data"
        message="This will clear all sessions from your browser's local storage and reset the cache. Sessions stored in Supabase (if logged in) will not be affected. Are you sure?"
        confirmText="Clear All"
        cancelText="Cancel"
        variant="danger"
        isLoading={isClearing}
      />
    </aside>
  );
}
