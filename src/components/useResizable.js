import { useState, useRef, useCallback, useEffect } from 'react';

export const useResizable = () => {
  const [leftPanelWidth, setLeftPanelWidth] = useState(256);
  const [rightPanelWidth, setRightPanelWidth] = useState(480);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(0);
  const [isTerminalVisible, setIsTerminalVisible] = useState(false);
  const [lastTerminalHeight, setLastTerminalHeight] = useState(200);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);
  
  const containerRef = useRef(null);

  // Handle left panel resize
  const handleLeftMouseDown = useCallback((e) => {
    setIsResizingLeft(true);
    e.preventDefault();
  }, []);

  // Handle right panel resize
  const handleRightMouseDown = useCallback((e) => {
    setIsResizingRight(true);
    e.preventDefault();
  }, []);

  // Handle bottom panel resize
  const handleBottomMouseDown = useCallback((e) => {
    setIsResizingBottom(true);
    e.preventDefault();
  }, []);

  // Toggle terminal visibility
  const toggleTerminal = useCallback(() => {
    if (isTerminalVisible) {
      // Hide terminal - save current height and set to 0
      setLastTerminalHeight(bottomPanelHeight);
      setBottomPanelHeight(0);
      setIsTerminalVisible(false);
    } else {
      // Show terminal - restore last height
      setBottomPanelHeight(lastTerminalHeight);
      setIsTerminalVisible(true);
    }
  }, [isTerminalVisible, bottomPanelHeight, lastTerminalHeight]);

  // Handle mouse move for resizing
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;

    if (isResizingLeft) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(Math.max(200, e.clientX - containerRect.left), 500);
      setLeftPanelWidth(newWidth);
    }

    if (isResizingRight) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(Math.max(300, containerRect.right - e.clientX), 600);
      setRightPanelWidth(newWidth);
    }

    if (isResizingBottom) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = Math.min(Math.max(0, containerRect.bottom - e.clientY), 400);
      setBottomPanelHeight(newHeight);
      // Update visibility state based on height
      if (newHeight > 0 && !isTerminalVisible) {
        setIsTerminalVisible(true);
      } else if (newHeight === 0 && isTerminalVisible) {
        setIsTerminalVisible(false);
      }
    }
  }, [isResizingLeft, isResizingRight, isResizingBottom]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsResizingLeft(false);
    setIsResizingRight(false);
    setIsResizingBottom(false);
  }, []);

  // Add event listeners
  useEffect(() => {
    if (isResizingLeft || isResizingRight || isResizingBottom) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      if (isResizingBottom) {
        document.body.style.cursor = 'row-resize';
      } else {
        document.body.style.cursor = 'col-resize';
      }
      
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingLeft, isResizingRight, isResizingBottom, handleMouseMove, handleMouseUp]);

  return {
    containerRef,
    leftPanelWidth,
    rightPanelWidth,
    bottomPanelHeight,
    isTerminalVisible,
    handleLeftMouseDown,
    handleRightMouseDown,
    handleBottomMouseDown,
    toggleTerminal,
  };
};
