import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { TerminalPanel } from '@/components/terminal/TerminalPanel';
import { MatchPanel } from '@/components/match-panel';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from '@/hooks/useSession';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { deleteSessionFromSupabase, isSupabaseConfigured } from '@/services/supabase';
import { useNBASchedule } from '@/hooks/useNBASchedule';
import { cn } from '@/utils/cn';
import { MatchupSessionProvider, useMatchupSessionContext } from '@/contexts/MatchupSessionContext';
import { MatchProvider } from '@/contexts/MatchContext';
import { useAutoMatchupSession } from '@/hooks/useAutoMatchupSession';
import { captureError } from '@/utils/errorTracking';
import type { Session } from '@/types';

export interface MainLayoutProps {
  agentId: string;
}

export function MainLayout({ agentId }: MainLayoutProps) {
  const handleMatchupSessionStarted = useCallback((_session: Session) => {}, []);

  return (
    <MatchProvider>
      <MatchupSessionProvider agentId={agentId} onSessionStarted={handleMatchupSessionStarted}>
        <MainLayoutContent agentId={agentId} />
      </MatchupSessionProvider>
    </MatchProvider>
  );
}

function MainLayoutContent({ agentId }: { agentId: string }) {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showMatchPanel, setShowMatchPanel] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(300);
  const { data: session } = useSession(currentSessionId);
  const queryClient = useQueryClient();
  const { isAuthenticated, supabaseUserId } = useAuth();
  const hasCreatedSession = useRef(false);
  const isResizing = useRef(false);
  const cleaningUpSessions = useRef<Set<string>>(new Set());
  const terminalResizeRef = useRef<HTMLDivElement>(null);
  
  const { liveGames } = useNBASchedule({ autoRefreshLive: showMatchPanel });
  const matchupContext = useMatchupSessionContext();

  useAutoMatchupSession({
    enabled: true,
    onSessionReady: useCallback((sessionId: string) => {
      setCurrentSessionId(sessionId);
      hasCreatedSession.current = true;
    }, []),
  });

  useEffect(() => {
    if (session) {
      setRoomId(session.channelId || session.sessionId);
    }
  }, [session]);

  useEffect(() => {
    if (matchupContext.activeMatchupSessionId && matchupContext.activeMatchupSessionId !== currentSessionId) {
      setCurrentSessionId(matchupContext.activeMatchupSessionId);
      hasCreatedSession.current = true;
    }
  }, [matchupContext.activeMatchupSessionId, currentSessionId]);

  useEffect(() => {
    if (currentSessionId || !agentId || hasCreatedSession.current) return;
    
    if (matchupContext.activeMatchupSessionId) {
      setCurrentSessionId(matchupContext.activeMatchupSessionId);
      hasCreatedSession.current = true;
      return;
    }
    
    // Don't auto-load sessions from IndexedDB - they may be stale
    // User should select a matchup to create a new session
    hasCreatedSession.current = true; // Prevent repeated attempts
  }, [currentSessionId, agentId, matchupContext.activeMatchupSessionId]);

  const handleSessionSelect = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    hasCreatedSession.current = true;
    
    const storage = await import('@/services/storage/conversationStorage');
    const stored = await storage.getSession(sessionId).catch(() => null);
    
    if (stored?.channelId) {
      setRoomId(stored.channelId);
      return;
    }
    
    try {
      const { getSession } = await import('@/services/api/sessions');
      const session = await getSession(sessionId);
      setRoomId(session?.channelId || sessionId);
      if (session) await storage.saveSession(session);
      } catch (error) {
        const { SessionNotFoundError } = await import('@/services/api/client');
        if (error instanceof SessionNotFoundError) {
          handleSessionInvalid(sessionId);
          return;
        }
        console.error('Error fetching session:', error);
        captureError(error instanceof Error ? error : new Error(String(error)), {
          component: 'MainLayout',
          action: 'handleSessionSelect',
          metadata: { sessionId },
        });
        setRoomId(sessionId);
      }
  };

  const handleSessionInvalid = async (invalidSessionId: string) => {
    // Prevent concurrent cleanup of the same session
    if (cleaningUpSessions.current.has(invalidSessionId)) {
      console.log('[MainLayout] Already cleaning up session:', invalidSessionId);
      return;
    }
    
    cleaningUpSessions.current.add(invalidSessionId);
    console.log('[MainLayout] Session invalid, cleaning up:', invalidSessionId);
    
    try {
      // Remove from React Query cache first to prevent retries
      queryClient.removeQueries({ queryKey: ['session', invalidSessionId] });
      queryClient.removeQueries({ queryKey: ['messages', invalidSessionId] });
      
      // Delete from local storage
      const storage = await import('@/services/storage/conversationStorage');
      await storage.deleteSession(invalidSessionId).catch((err) => {
        console.error('[MainLayout] Failed to delete session from local storage:', err);
      });
      
      // Delete from Supabase if authenticated
      if (isAuthenticated && supabaseUserId && isSupabaseConfigured()) {
        await deleteSessionFromSupabase(invalidSessionId).catch((err) => {
          console.error('[MainLayout] Failed to delete session from Supabase:', err);
        });
      }
      
      // Invalidate sessions list to refresh sidebar
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      
      // Clear current session if it's the invalid one
      if (currentSessionId === invalidSessionId) {
        setCurrentSessionId(null);
        setRoomId(null);
        hasCreatedSession.current = true; // Prevent auto-loading stale sessions
      }
    } finally {
      // Remove from cleanup set after a delay to allow for any pending operations
      setTimeout(() => {
        cleaningUpSessions.current.delete(invalidSessionId);
      }, 1000);
    }
  };

  useEffect(() => {
    if (!isResizing.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = window.innerHeight - e.clientY;
      setTerminalHeight(Math.max(100, Math.min(window.innerHeight * 0.7, newHeight)));
    };

    const handleMouseUp = () => {
      isResizing.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing.current]);

  const handleResizeStart = () => {
    isResizing.current = true;
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground hud-scanlines relative">
      {/* HUD Background Overlay */}
      <div className="hud-bg-overlay" />
      
      <Header 
        showTerminal={showTerminal} 
        onToggleTerminal={() => setShowTerminal(!showTerminal)}
        showMatchPanel={showMatchPanel}
        onToggleMatchPanel={() => setShowMatchPanel(!showMatchPanel)}
        hasLiveGames={liveGames.length > 0}
      />
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            currentSessionId={currentSessionId}
            onSessionSelect={handleSessionSelect}
            agentId={agentId}
          />
          <main className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 flex overflow-hidden">
              <div
                className={cn('flex-1 flex flex-col overflow-hidden', showTerminal && 'pb-0')}
                style={showTerminal ? { height: `calc(100% - ${terminalHeight}px)` } : undefined}
              >
                {currentSessionId ? (
                  <ChatContainer
                    sessionId={currentSessionId}
                    agentId={agentId}
                    roomId={roomId || currentSessionId}
                    onSessionInvalid={handleSessionInvalid}
                    showMessageInput={true}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <span>Select a session or create a new one</span>
                  </div>
                )}
              </div>
              
              {showMatchPanel && (
                <MatchPanel defaultExpanded={true} />
              )}
            </div>
            
            {showTerminal && (
              <>
                <div
                  ref={terminalResizeRef}
                  className="h-1 bg-border hover:bg-primary cursor-row-resize transition-colors"
                  onMouseDown={handleResizeStart}
                  style={{ height: '4px' }}
                />
                <div style={{ height: `${terminalHeight}px` }} className="flex-shrink-0">
                  <TerminalPanel
                    welcomeMessage="Agent Daredevil Terminal\nType commands or interact with the agent here:"
                    prompt="$ "
                    onCommand={(command) => {
                      console.log('Terminal command:', command);
                    }}
                  />
                </div>
              </>
            )}
          </main>
        </div>
      </div>
      
      {!showMatchPanel && <MatchPanel defaultExpanded={false} />}
    </div>
  );
}
