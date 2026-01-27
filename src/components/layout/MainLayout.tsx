import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { TerminalPanel } from '@/components/terminal/TerminalPanel';
import { MatchPanel } from '@/components/match-panel';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from '@/hooks/useSession';
import { useQueryClient } from '@tanstack/react-query';
import { useNBASchedule } from '@/hooks/useNBASchedule';
import { cn } from '@/utils/cn';
import { MatchupSessionProvider } from '@/contexts/MatchupSessionContext';
import type { Session } from '@/types';

export interface MainLayoutProps {
  agentId: string;
}

export function MainLayout({ agentId }: MainLayoutProps) {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showMatchPanel, setShowMatchPanel] = useState(true); // Default expanded
  const [terminalHeight, setTerminalHeight] = useState(300);
  const { data: session } = useSession(currentSessionId);
  const queryClient = useQueryClient();
  const hasCreatedSession = useRef(false);
  const isResizing = useRef(false);
  const terminalResizeRef = useRef<HTMLDivElement>(null);
  
  // Get live game status for header indicator
  const { liveGames } = useNBASchedule({ autoRefreshLive: showMatchPanel });

  useEffect(() => {
    if (session) {
      setRoomId(session.channelId || session.sessionId);
    }
  }, [session]);

  // Load existing session from storage on mount (NO auto-creation)
  useEffect(() => {
    if (currentSessionId || !agentId || hasCreatedSession.current) return;
    
    const loadExistingSession = async () => {
      try {
        const { getAllSessions } = await import('@/services/storage/conversationStorage');
        const { getUserId } = await import('@/utils/storage');
        const existingSessions = await getAllSessions(getUserId());
        
        if (existingSessions.length > 0) {
          const latestSession = existingSessions[0];
          setCurrentSessionId(latestSession.sessionId);
          setRoomId(latestSession.channelId);
          hasCreatedSession.current = true;
        }
        // If no sessions exist, just show empty state - user can click "New Session"
      } catch (error) {
        console.error('Error checking existing sessions:', error);
      }
    };
    
    loadExistingSession();
  }, [currentSessionId, agentId]);

  const handleSessionSelect = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    hasCreatedSession.current = true;
    
    // Try to get roomId from stored session first
    const storage = await import('@/services/storage/conversationStorage');
    const stored = await storage.getSession(sessionId).catch(() => null);
    
    if (stored?.channelId) {
      setRoomId(stored.channelId);
      return;
    }
    
    // If not in storage, fetch from API
    try {
      const { getSession } = await import('@/services/api/sessions');
      const session = await getSession(sessionId);
      setRoomId(session?.channelId || sessionId);
      if (session) await storage.saveSession(session);
    } catch (error) {
      // If session not found, mark it as invalid
      const { SessionNotFoundError } = await import('@/services/api/client');
      if (error instanceof SessionNotFoundError) {
        console.warn(`[MainLayout] Session ${sessionId.slice(0, 8)}... not found on backend`);
        handleSessionInvalid(sessionId);
        return;
      }
      console.error('Error fetching session from API:', error);
      setRoomId(sessionId); // Fallback to sessionId
    }
  };

  const handleSessionInvalid = async (invalidSessionId: string) => {
    // Remove invalid session from storage
    const storage = await import('@/services/storage/conversationStorage');
    await storage.deleteSession(invalidSessionId).catch(console.error);
    
    // Remove from React Query cache
    queryClient.removeQueries({ queryKey: ['session', invalidSessionId] });
    queryClient.removeQueries({ queryKey: ['messages', invalidSessionId] });
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
    
    // If this was the current session, clear it
    if (currentSessionId === invalidSessionId) {
      setCurrentSessionId(null);
      setRoomId(null);
      hasCreatedSession.current = false;
    }
  };

  // Terminal resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newHeight = window.innerHeight - e.clientY;
      const minHeight = 100;
      const maxHeight = window.innerHeight * 0.7;
      setTerminalHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
    };

    const handleMouseUp = () => {
      isResizing.current = false;
    };

    if (isResizing.current) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing.current]);

  const handleResizeStart = () => {
    isResizing.current = true;
  };

  // Handle when a matchup session is started from MatchPanel
  const handleMatchupSessionStarted = useCallback((session: Session) => {
    setCurrentSessionId(session.sessionId);
    setRoomId(session.channelId || session.sessionId);
    hasCreatedSession.current = true;
  }, []);

  return (
    <MatchupSessionProvider agentId={agentId} onSessionStarted={handleMatchupSessionStarted}>
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
              {/* Main content area */}
              <div
                className={cn('flex-1 flex flex-col overflow-hidden', showTerminal && 'pb-0')}
                style={showTerminal ? { height: `calc(100% - ${terminalHeight}px)` } : undefined}
              >
                {currentSessionId ? (
                  <ChatContainer
                    sessionId={currentSessionId}
                    agentId={agentId}
                    roomId={roomId || currentSessionId} // Fallback to sessionId if roomId not available
                    onSessionInvalid={handleSessionInvalid}
                    showMessageInput={true}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <span>Select a session or create a new one</span>
                  </div>
                )}
              </div>
              
              {/* Match Panel (upper-right) */}
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
                      // You can integrate this with your agent or execute commands here
                    }}
                  />
                </div>
              </>
            )}
          </main>
        </div>
        
      </div>
      
      {/* Mobile Match Panel (rendered outside main layout for full-screen overlay) */}
      {!showMatchPanel && <MatchPanel defaultExpanded={false} />}
    </div>
    </MatchupSessionProvider>
  );
}
