/**
 * Knowledge Modal Component
 * 
 * Modal for managing session-scoped RAG knowledge.
 * Allows users to add up to 5 sports article URLs for context enrichment.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Trash2,
  Link,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { useSessionKnowledge } from '@/hooks/useSessionKnowledge';
import { validateKnowledgeUrl } from '@/utils/chunking';
import type { KnowledgeSource } from '@/types/knowledge';

// ============================================================================
// TYPES
// ============================================================================

export interface KnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  userId: string | null;
}

// ============================================================================
// STATUS COMPONENTS
// ============================================================================

function StatusIcon({ status }: { status: KnowledgeSource['status'] }) {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
  }
}

function StatusText({ status, errorMessage }: { status: KnowledgeSource['status']; errorMessage: string | null }) {
  switch (status) {
    case 'pending':
      return <span className="text-xs text-muted-foreground">Queued...</span>;
    case 'processing':
      return <span className="text-xs text-blue-500">Processing article...</span>;
    case 'completed':
      return <span className="text-xs text-green-500">Ready</span>;
    case 'failed':
      return (
        <span className="text-xs text-red-500" title={errorMessage || 'Failed'}>
          {errorMessage?.slice(0, 50) || 'Failed to process'}
          {errorMessage && errorMessage.length > 50 ? '...' : ''}
        </span>
      );
  }
}

// ============================================================================
// SOURCE ITEM COMPONENT
// ============================================================================

interface SourceItemProps {
  source: KnowledgeSource;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function SourceItem({ source, onDelete, isDeleting }: SourceItemProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        source.status === 'completed' && 'bg-green-500/5 border-green-500/20',
        source.status === 'processing' && 'bg-blue-500/5 border-blue-500/20',
        source.status === 'pending' && 'bg-muted/50 border-border',
        source.status === 'failed' && 'bg-red-500/5 border-red-500/20'
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        <StatusIcon status={source.status} />
      </div>
      
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium truncate">
              {source.title || 'Processing...'}
            </h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">{source.sourceDomain}</span>
              {source.wordCount && (
                <>
                  <span>•</span>
                  <span>{source.wordCount.toLocaleString()} words</span>
                </>
              )}
              {source.chunkCount > 0 && (
                <>
                  <span>•</span>
                  <span>{source.chunkCount} chunks</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded hover:bg-accent transition-colors"
              title="Open article"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onDelete(source.id)}
              disabled={isDeleting}
              title="Remove article"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
        
        <StatusText status={source.status} errorMessage={source.errorMessage} />
      </div>
    </div>
  );
}

// ============================================================================
// RATE LIMIT BANNER
// ============================================================================

function RateLimitBanner({ resetAt }: { resetAt: string | null }) {
  const getResetMessage = () => {
    if (!resetAt) return 'Please try again later.';
    
    const resetDate = new Date(resetAt);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Rate limit should be reset now. Try refreshing.';
    
    const diffMinutes = Math.ceil(diffMs / 60000);
    if (diffMinutes < 60) {
      return `Resets in ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}.`;
    }
    
    const diffHours = Math.ceil(diffMinutes / 60);
    return `Resets in ${diffHours} hour${diffHours === 1 ? '' : 's'}.`;
  };

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
      <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
      <div className="text-sm">
        <span className="font-medium text-yellow-500">Rate limit reached.</span>{' '}
        <span className="text-muted-foreground">{getResetMessage()}</span>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function KnowledgeModal({ isOpen, onClose, sessionId, userId }: KnowledgeModalProps) {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const {
    sources,
    isLoading,
    isRateLimited,
    rateLimitResetAt,
    maxSources,
    isAtLimit,
    addSource,
    deleteSource,
    isAdding,
    error,
  } = useSessionKnowledge(sessionId, userId);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Clear URL input when a source is successfully added
  useEffect(() => {
    if (!isAdding && !error && url) {
      // If we just finished adding and there was no error, the add was successful
      // But we need to track this better - for now, don't auto-clear
    }
  }, [isAdding, error, url]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Validate and add URL
  const handleAddUrl = useCallback(async () => {
    if (!sessionId) {
      setUrlError('Please select a session first');
      return;
    }

    const trimmedUrl = url.trim();
    
    // Validate
    const validationError = validateKnowledgeUrl(trimmedUrl);
    if (validationError) {
      setUrlError(validationError);
      return;
    }

    setUrlError(null);

    try {
      await addSource(trimmedUrl);
      setUrl(''); // Clear on success
    } catch (err) {
      if (err instanceof Error) {
        setUrlError(err.message);
      }
    }
  }, [url, addSource, sessionId]);

  // Handle enter key in input
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isAdding) {
      handleAddUrl();
    }
  };

  // Handle delete
  const handleDelete = useCallback(async (sourceId: string) => {
    setDeletingId(sourceId);
    try {
      await deleteSource(sourceId);
    } finally {
      setDeletingId(null);
    }
  }, [deleteSource]);

  // Clear error when URL changes
  useEffect(() => {
    if (urlError) {
      setUrlError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (!isOpen) return null;

  const canAddMore = !isAtLimit && !isRateLimited;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-background border border-border rounded-lg shadow-xl animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 id="knowledge-modal-title" className="text-lg font-semibold">
                Session Knowledge
              </h2>
              <p className="text-xs text-muted-foreground">
                Add sports articles for enhanced predictions
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* No session warning */}
          {!sessionId && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-blue-500">No session selected.</span>{' '}
                <span className="text-muted-foreground">Create or select a session to add knowledge articles.</span>
              </div>
            </div>
          )}

          {/* Rate limit warning */}
          {isRateLimited && <RateLimitBanner resetAt={rateLimitResetAt} />}

          {/* URL Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Link className="h-4 w-4" />
              Add Article URL
              <span className="text-muted-foreground font-normal">
                ({sources.length}/{maxSources})
              </span>
            </label>
            
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="url"
                placeholder="https://espn.com/nba/story/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyPress}
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex-1',
                  urlError && 'border-red-500 focus-visible:ring-red-500',
                  isAdding && 'opacity-50 cursor-not-allowed'
                )}
              />
              <Button
                onClick={handleAddUrl}
                disabled={isAdding || !url.trim()}
                className="flex-shrink-0"
              >
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Add</span>
              </Button>
            </div>
            
            {urlError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {urlError}
              </p>
            )}
            
            {isAtLimit && !isRateLimited && (
              <p className="text-xs text-muted-foreground">
                Maximum {maxSources} articles per session. Remove one to add another.
              </p>
            )}
          </div>

          {/* Sources List */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No articles added yet</p>
                <p className="text-xs mt-1">
                  Paste a URL above to add sports article context
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sources.map((source) => (
                  <SourceItem
                    key={source.id}
                    source={source}
                    onDelete={handleDelete}
                    isDeleting={deletingId === source.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 flex-shrink-0">
          <p className="text-xs text-muted-foreground text-center">
            Knowledge is used as context for this session only and helps improve prediction accuracy.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
