import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { TerminalPanel } from '@/components/terminal/TerminalPanel';
import { MatchPanel } from '@/components/match-panel';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useCreateSession, useSession } from '@/hooks/useSession';
import { useQueryClient } from '@tanstack/react-query';
import { useNBASchedule } from '@/hooks/useNBASchedule';
import { cn } from '@/utils/cn';

export interface MainLayoutProps {
  agentId: string;
}

// Constants for retry logic
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds

export function MainLayout({ agentId }: MainLayoutProps) {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showMatchPanel, setShowMatchPanel] = useState(true); // Default expanded
  const [terminalHeight, setTerminalHeight] = useState(300);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const createSession = useCreateSession();
  const { data: session } = useSession(currentSessionId);
  const queryClient = useQueryClient();
  const hasCreatedSession = useRef(false);
  const isResizing = useRef(false);
  const terminalResizeRef = useRef<HTMLDivElement>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Get live game status for header indicator
  const { liveGames } = useNBASchedule({ autoRefreshLive: showMatchPanel });

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (session) {
      setRoomId(session.channelId || session.sessionId);
      setConnectionError(null); // Clear error on successful session
    }
  }, [session]);

  const handleRetry = useCallback(() => {
    setConnectionError(null);
    setRetryCount(0);
    hasCreatedSession.current = false;
  }, []);

  useEffect(() => {
    if (currentSessionId || !agentId || hasCreatedSession.current || createSession.isPending) return;
    
    const initializeSession = async () => {
      try {
        const { getAllSessions } = await import('@/services/storage/conversationStorage');
        const { getUserId } = await import('@/utils/storage');
        const existingSessions = await getAllSessions(getUserId());
        
        if (existingSessions.length > 0) {
          const latestSession = existingSessions[0];
          setCurrentSessionId(latestSession.sessionId);
          setRoomId(latestSession.channelId);
          hasCreatedSession.current = true;
          setConnectionError(null);
          return;
        }
      } catch (error) {
        console.error('Error checking existing sessions:', error);
      }
      
      // No existing sessions, create a new one
      hasCreatedSession.current = true;
      createSession.mutate(
        { agentId },
        {
          onSuccess: (newSession) => {
            setCurrentSessionId(newSession.sessionId);
            setRoomId(newSession.channelId);
            setConnectionError(null);
            setRetryCount(0);
          },
          onError: (error) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Check if we should retry
            if (retryCount < MAX_RETRY_ATTEMPTS) {
              const nextRetryCount = retryCount + 1;
              const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
              
              console.warn(`Session creation failed (attempt ${nextRetryCount}/${MAX_RETRY_ATTEMPTS}). Retrying in ${delay}ms...`);
              
              retryTimeoutRef.current = setTimeout(() => {
                setRetryCount(nextRetryCount);
                hasCreatedSession.current = false; // Allow retry
              }, delay);
            } else {
              // Max retries reached, show error
              console.error('Session creation failed after max retries:', errorMessage);
              setConnectionError(
                errorMessage.includes('404') || errorMessage.includes('Not found')
                  ? 'Backend API not available. The Sessions API endpoint returned 404. Please check that the elizaOS backend is running and supports the Sessions API.'
                  : errorMessage.includes('Network')
                    ? 'Cannot connect to backend. Please check your network connection and that the backend server is running.'
                    : `Failed to create session: ${errorMessage}`
              );
            }
          },
        }
      );
    };
    
    initializeSession();
  }, [currentSessionId, agentId, createSession, retryCount]);

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
    
    // If this was the current session, clear it and trigger retry logic
    if (currentSessionId === invalidSessionId) {
      setCurrentSessionId(null);
      setRoomId(null);
      setRetryCount(0); // Reset retry count for new attempt
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
      <div className="flex-1 flex overflow-hidden relative z-10">
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
                />
              ) : connectionError ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <svg 
                      className="w-8 h-8 text-destructive" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                      />
                    </svg>
                  </div>
                  <div className="max-w-md space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">Connection Error</h3>
                    <p className="text-sm text-muted-foreground">{connectionError}</p>
                  </div>
                  <button
                    onClick={handleRetry}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Retry Connection
                  </button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Attempted {retryCount} of {MAX_RETRY_ATTEMPTS} retries
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  {createSession.isPending ? (
                    <>
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>Creating session{retryCount > 0 ? ` (retry ${retryCount}/${MAX_RETRY_ATTEMPTS})` : '...'}</span>
                    </>
                  ) : (
                    'Select a session or create a new one'
                  )}
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
      
      {/* Mobile Match Panel (rendered outside main layout for full-screen overlay) */}
      {!showMatchPanel && <MatchPanel defaultExpanded={false} />}
    </div>
  );
}
