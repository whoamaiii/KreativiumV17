import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

interface AccessibilityWrapperProps {
  children: React.ReactNode;
  skipToContent?: boolean;
  announceChanges?: boolean;
}

export const AccessibilityWrapper: React.FC<AccessibilityWrapperProps> = ({
  children,
  skipToContent = true,
  announceChanges = true
}) => {
  const { tCommon } = useTranslation();

  const handleSkip = useCallback((e: React.MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    const main = document.getElementById('main-content') as HTMLElement | null;
    if (main) {
      main.focus();
      try {
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
        main.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      } catch {
        // no-op
      }
    }
  }, []);

  return (
    <>
      {skipToContent && (
        <a
          href="#main-content"
          onClick={handleSkip}
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground px-4 py-2 rounded-md z-50 font-dyslexia"
          id="skip-to-content"
        >
          {String(tCommon('accessibility.skipToContent'))}
        </a>
      )}
      
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>

      {announceChanges && (
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          id="accessibility-announcements"
        />
      )}
    </>
  );
};
