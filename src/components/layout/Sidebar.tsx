import { Plus, Trash2, Brain } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useSessions, useDeleteSession, useCreateSession } from '@/hooks/useSession';
import { useAuth } from '@/hooks/useAuth';
import { KnowledgeModal } from '@/components/knowledge/KnowledgeModal';
import { format } from 'date-fns';
import { cn } from '@/utils/cn';
import { useState } from 'react';
import type { Session, SessionMetadata } from '@/types';
import { LiveTeamStats } from '@/components/sidebar/LiveTeamStats';

// Feature flag: Knowledge feature temporarily disabled
const KNOWLEDGE_FEATURE_ENABLED = false;

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
  const { data: sessions = [], isLoading } = useSessions();
  const deleteSession = useDeleteSession();
  const createSession = useCreateSession();
  const { supabaseUserId } = useAuth();
  const [showKnowledge, setShowKnowledge] = useState(false);
  
  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    sessionId: string | null;
    sessionTitle: string;
  }>({ isOpen: false, sessionId: null, sessionTitle: '' });

  const handleNewSession = () => {
    createSession.mutate(
      { agentId },
      {
        onSuccess: (session) => {
          onSessionSelect(session.sessionId);
        },
        onError: (error) => {
          console.error('[Sidebar] Failed to create session:', error);
          // Check if it's a storage error
          const isStorageError = error instanceof Error && (
            error.name === 'QuotaExceededError' ||
            error.name === 'UnknownError' ||
            error.message.includes('Internal error') ||
            error.message.includes('storage') ||
            error.message.includes('quota') ||
            error.message.includes('no space')
          );
          
          if (isStorageError) {
            alert('Unable to create session: Browser storage is full. Please clear your browser data for this site and try again.');
          } else {
            alert('Failed to create session. Please try again.');
          }
        },
      }
    );
  };

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
        <Button onClick={handleNewSession} className="w-full text-white" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Session
        </Button>
        <Button
          variant="outline"
          className="w-full"
          size="sm"
          onClick={() => KNOWLEDGE_FEATURE_ENABLED && setShowKnowledge(true)}
          disabled={!KNOWLEDGE_FEATURE_ENABLED}
          title={KNOWLEDGE_FEATURE_ENABLED 
            ? "Add article knowledge for enhanced predictions" 
            : "Knowledge feature temporarily disabled"}
        >
          <Brain className="h-4 w-4 mr-2" />
          Knowledge
        </Button>
      </div>
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

      {/* Knowledge Modal */}
      {KNOWLEDGE_FEATURE_ENABLED && (
        <KnowledgeModal
          isOpen={showKnowledge}
          onClose={() => setShowKnowledge(false)}
          sessionId={currentSessionId}
          userId={supabaseUserId}
        />
      )}
    </aside>
  );
}
