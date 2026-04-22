import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';

const SHOW_DELAY_MS = 300;
const HIDE_DELAY_MS = 150;

interface InfoTooltipState {
  visible: boolean;
  anchorRect: DOMRect | null;
}

interface InfoTooltipProps {
  id: string;
  description: string;
  example?: string;
  anchorRect: DOMRect | null;
  visible: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDismiss: () => void;
}

function TooltipBubble({
  id,
  description,
  example,
  anchorRect,
  onMouseEnter,
  onMouseLeave,
  onDismiss,
}: InfoTooltipProps): React.JSX.Element | null {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipHeight, setTooltipHeight] = useState(0);

  useEffect(() => {
    if (tooltipRef.current != null) {
      setTooltipHeight(tooltipRef.current.offsetHeight);
    }
  });

  // Dismiss on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onDismiss();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onDismiss]);

  // Dismiss on mousedown outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent): void {
      if (tooltipRef.current != null && !tooltipRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onDismiss]);

  const positionStyle = React.useMemo((): React.CSSProperties => {
    if (anchorRect == null) {
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: '280px' };
    }

    const gap = 8;
    const edgeClamp = 8;
    const preferAbove = anchorRect.top - tooltipHeight - gap >= edgeClamp;
    const top = preferAbove
      ? anchorRect.top - gap
      : anchorRect.bottom + gap;
    const left = Math.max(edgeClamp, Math.min(anchorRect.left, window.innerWidth - 280 - edgeClamp));

    return {
      position: 'fixed',
      top,
      left,
      maxWidth: '280px',
      transform: preferAbove ? 'translateY(-100%)' : undefined,
    };
  }, [anchorRect, tooltipHeight]);

  return ReactDOM.createPortal(
    <div
      ref={tooltipRef}
      id={id}
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        ...positionStyle,
        background: 'rgba(247, 249, 251, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(225, 227, 232, 0.6)',
        borderRadius: '12px',
        boxShadow: '0 12px 32px -4px rgba(25, 28, 30, 0.08)',
        padding: '16px',
        zIndex: 2147483647,
        fontFamily: 'Inter, system-ui, sans-serif',
        animation: 'sd-info-tooltip-in 160ms ease-out',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '12px',
          color: '#191c1e',
          fontWeight: 400,
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
      {example !== undefined && (
        <p
          style={{
            margin: '8px 0 0',
            fontSize: '12px',
            color: '#45474c',
            fontStyle: 'italic',
            fontWeight: 400,
            lineHeight: 1.5,
          }}
        >
          {example}
        </p>
      )}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Hook — encapsulates show/hide timer logic for a single InfoIcon+InfoTooltip pair
// ---------------------------------------------------------------------------

interface UseInfoTooltipReturn {
  tooltipVisible: boolean;
  anchorRect: DOMRect | null;
  handleIconMouseEnter: (rect: DOMRect) => void;
  handleIconMouseLeave: () => void;
  handleIconFocus: (rect: DOMRect) => void;
  handleIconBlur: () => void;
  handleTooltipMouseEnter: () => void;
  handleTooltipMouseLeave: () => void;
  handleDismiss: () => void;
}

export function useInfoTooltip(): UseInfoTooltipReturn {
  const [state, setState] = useState<InfoTooltipState>({ visible: false, anchorRect: null });
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback((): void => {
    if (showTimer.current != null) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current != null) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const show = useCallback((rect: DOMRect): void => {
    clearTimers();
    setState({ visible: true, anchorRect: rect });
  }, [clearTimers]);

  const hide = useCallback((): void => {
    clearTimers();
    setState((prev) => ({ ...prev, visible: false }));
  }, [clearTimers]);

  const scheduleShow = useCallback((rect: DOMRect): void => {
    clearTimers();
    showTimer.current = setTimeout(() => {
      setState({ visible: true, anchorRect: rect });
    }, SHOW_DELAY_MS);
  }, [clearTimers]);

  const scheduleHide = useCallback((): void => {
    clearTimers();
    hideTimer.current = setTimeout(() => {
      setState((prev) => ({ ...prev, visible: false }));
    }, HIDE_DELAY_MS);
  }, [clearTimers]);

  // Cleanup on unmount
  useEffect(() => clearTimers, [clearTimers]);

  return {
    tooltipVisible: state.visible,
    anchorRect: state.anchorRect,
    handleIconMouseEnter: scheduleShow,
    handleIconMouseLeave: scheduleHide,
    handleIconFocus: show,
    handleIconBlur: hide,
    handleTooltipMouseEnter: clearTimers,
    handleTooltipMouseLeave: scheduleHide,
    handleDismiss: hide,
  };
}

export { SHOW_DELAY_MS, HIDE_DELAY_MS };
export default TooltipBubble;
