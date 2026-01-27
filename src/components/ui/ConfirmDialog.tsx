/**
 * Confirmation Dialog Component
 * Shows a modal dialog asking for user confirmation
 * Uses React Portal to render outside of parent stacking contexts
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/utils/cn';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button when dialog opens
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'text-red-500',
      button: 'bg-red-600 hover:bg-red-700 text-white',
    },
    warning: {
      icon: 'text-yellow-500',
      button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    },
    default: {
      icon: 'text-blue-500',
      button: 'bg-primary hover:bg-primary/90 text-primary-foreground',
    },
  };

  const styles = variantStyles[variant];

  // Use portal to render dialog at document root (outside any stacking contexts)
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md bg-background border border-border rounded-lg shadow-xl animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-full bg-muted', styles.icon)}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 id="confirm-dialog-title" className="text-lg font-semibold">
              {title}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isLoading}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-muted-foreground">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            ref={confirmButtonRef}
            className={styles.button}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
