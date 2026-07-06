import { useEffect, useRef, useState } from 'react';
import { MonitorPlay, Maximize2, Minimize2, Keyboard, MousePointer, ChevronUp, ChevronDown, Clipboard, XCircle } from 'lucide-react';

interface Props {
  stream: MediaStream | null;
  onMouseEvent: (type: string, x: number, y: number) => void;
  onKeyEvent?: (key: string) => void;
  platform?: 'android' | 'windows';
  onDisconnect?: () => void;
}

export default function ScreenViewer({ stream, onMouseEvent, onKeyEvent, platform = 'android', onDisconnect }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const keyboardInputRef = useRef<HTMLInputElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRightClickMode, setIsRightClickMode] = useState(false);

  const isKeyboardActiveRef = useRef(false);
  const touchMouseStartRef = useRef<{ x: number; y: number; time: number; isTap: boolean } | null>(null);

  const scaleRef = useRef(1);
  const positionRef = useRef({ x: 0, y: 0 });
  const refocusTimeoutRef = useRef<any>(null);

  const updateVideoTransform = () => {
    if (videoRef.current) {
      videoRef.current.style.transform = `scale(${scaleRef.current}) translate(${positionRef.current.x}px, ${positionRef.current.y}px)`;
      videoRef.current.style.transition = scaleRef.current === 1 ? 'transform 0.2s ease-out' : 'none';
    }
  };

  const touchStartRef = useRef({
    distance: 0,
    scale: 1,
    x: 0,
    y: 0,
    posX: 0,
    posY: 0,
    isPinching: false
  });

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      // Single finger: panning
      const touch = e.touches[0];
      touchStartRef.current = {
        ...touchStartRef.current,
        x: touch.clientX,
        y: touch.clientY,
        posX: positionRef.current.x,
        posY: positionRef.current.y,
        isPinching: false
      };
    } else if (e.touches.length === 2) {
      // Two fingers: pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      touchStartRef.current = {
        ...touchStartRef.current,
        distance: dist,
        scale: scaleRef.current,
        posX: positionRef.current.x,
        posY: positionRef.current.y,
        isPinching: true
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && !touchStartRef.current.isPinching) {
      if (scaleRef.current > 1) {
        // Only allow scroll/pan on remote screen if zoomed in
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;
        
        // Calculate translation relative to zoom scale factor
        const newX = touchStartRef.current.posX + dx / scaleRef.current;
        const newY = touchStartRef.current.posY + dy / scaleRef.current;

        // Cap pan boundaries based on current scale to prevent dragging video off screen
        const maxPanX = (scaleRef.current - 1) * 180;
        const maxPanY = (scaleRef.current - 1) * 180;

        positionRef.current = {
          x: Math.min(Math.max(newX, -maxPanX), maxPanX),
          y: Math.min(Math.max(newY, -maxPanY), maxPanY)
        };

        updateVideoTransform();
      }
    } else if (e.touches.length === 2) {
      // Pinching
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const factor = dist / touchStartRef.current.distance;
      const newScale = Math.min(Math.max(touchStartRef.current.scale * factor, 1), 5);
      
      scaleRef.current = newScale;
      
      // If scale returns to 1, reset panning coordinates
      if (newScale === 1) {
        positionRef.current = { x: 0, y: 0 };
      }

      updateVideoTransform();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) {
      touchStartRef.current.isPinching = false;
    }
  };

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.srcObject = stream;
      if (!stream) {
        try {
          videoElement.pause();
          videoElement.src = "";
          videoElement.load();
        } catch (e) {}
      }
    }
    // Reset zoom on stream change
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    updateVideoTransform();

    return () => {
      if (videoElement) {
        try {
          videoElement.pause();
          videoElement.srcObject = null;
          videoElement.src = "";
          videoElement.load();
        } catch (e) {}
      }
    };
  }, [stream]);

  const sendMouseEventAtPointer = (clientX: number, clientY: number, button: number, video: HTMLVideoElement, type: string) => {
    const rect = video.getBoundingClientRect();
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    if (!videoWidth || !videoHeight) return;

    const containerRatio = rect.width / rect.height;
    const videoRatio = videoWidth / videoHeight;

    let actualWidth, actualHeight, startX, startY;

    if (containerRatio > videoRatio) {
      actualHeight = rect.height;
      actualWidth = actualHeight * videoRatio;
      startX = (rect.width - actualWidth) / 2;
      startY = 0;
    } else {
      actualWidth = rect.width;
      actualHeight = actualWidth / videoRatio;
      startX = 0;
      startY = (rect.height - actualHeight) / 2;
    }

    const x = (clientX - rect.left - startX) / actualWidth;
    const y = (clientY - rect.top - startY) / actualHeight;
    
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      let eventType = type;
      if (button === 2 || isRightClickMode) {
        if (type === 'down') eventType = 'rightdown';
        else if (type === 'up') {
          eventType = 'rightup';
          setIsRightClickMode(false);
        }
      }
      onMouseEvent(eventType, x, y);
    }
  };

  const handlePointerEvent = (e: React.PointerEvent<HTMLVideoElement>, type: string) => {
    // Ignore secondary pointers for touch
    if (e.pointerType === 'touch' && !e.isPrimary) {
      return;
    }

    const video = e.currentTarget;

    if (e.pointerType === 'touch' && scaleRef.current > 1) {
      if (type === 'down') {
        touchMouseStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          time: Date.now(),
          isTap: true
        };
        return;
      }
      
      if (type === 'move') {
        if (touchMouseStartRef.current) {
          const dx = e.clientX - touchMouseStartRef.current.x;
          const dy = e.clientY - touchMouseStartRef.current.y;
          if (Math.hypot(dx, dy) > 10) {
            touchMouseStartRef.current.isTap = false;
          }
        }
        return;
      }

      if (type === 'up') {
        if (touchMouseStartRef.current && touchMouseStartRef.current.isTap) {
          const elapsed = Date.now() - touchMouseStartRef.current.time;
          if (elapsed < 300) {
            sendMouseEventAtPointer(e.clientX, e.clientY, e.button, video, 'down');
            setTimeout(() => {
              sendMouseEventAtPointer(e.clientX, e.clientY, e.button, video, 'up');
            }, 20);
          }
        }
        touchMouseStartRef.current = null;
        return;
      }
    }

    // Normal behavior (mouse, or touch when scale === 1)
    sendMouseEventAtPointer(e.clientX, e.clientY, e.button, video, type);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!onKeyEvent) return;
      
      // Ignorar si el usuario está escribiendo en un input de Windows (ej. chat, archivos)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Interceptar Ctrl+V o Cmd+V para portapapeles compartido
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          if (text) {
            onKeyEvent('CLIPBOARD_PASTE:' + text);
          }
        }).catch(err => {
          console.error("Failed to read local clipboard:", err);
        });
        return;
      }

      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Escape'].includes(e.code) || e.key.length === 1) {
        e.preventDefault();
        onKeyEvent(e.key);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onKeyEvent('Enter');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onKeyEvent]);

  // Watchdog hook to prevent the video element from getting paused/stuck by browser autoplay or focus throttling
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePause = () => {
      if (stream && video.paused) {
        video.play().catch(err => console.warn("[ScreenViewer] video.play failed on pause event:", err));
      }
    };

    video.addEventListener('pause', handlePause);
    return () => {
      video.removeEventListener('pause', handlePause);
    };
  }, [stream]);

  const handleWheelEvent = (e: React.WheelEvent<HTMLVideoElement>) => {
    // deltaY > 0 means scroll down (send negative value to csc), deltaY < 0 means scroll up (send positive)
    const scrollAmount = e.deltaY > 0 ? -120 : 120;
    onMouseEvent('wheel', scrollAmount, 0);
  };

  const handleKeyboardInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onKeyEvent) return;
    const value = e.target.value;
    
    if (value === "") {
      // Android Backspace case: the spacer space was deleted
      onKeyEvent("Backspace");
      e.target.value = " ";
    } else if (value === " ") {
      // No change
    } else {
      // Characters were added.
      // Since it starts with " ", we extract the added characters
      if (value.startsWith(" ")) {
        const added = value.slice(1);
        for (let i = 0; i < added.length; i++) {
          onKeyEvent(added[i]);
        }
      } else {
        // In case the spacer space was replaced/deleted during composition
        for (let i = 0; i < value.length; i++) {
          onKeyEvent(value[i]);
        }
      }
      // Reset the spacer space
      e.target.value = " ";
    }
  };

  const handleKeyboardKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!onKeyEvent) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      onKeyEvent('Backspace');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onKeyEvent('Enter');
    }
  };

  const handleMobilePaste = () => {
    if (!onKeyEvent) return;
    navigator.clipboard.readText().then(text => {
      if (text) {
        onKeyEvent('CLIPBOARD_PASTE:' + text);
      }
    }).catch(err => {
      console.error("Failed to read local clipboard:", err);
    });
  };

  const handleInputBlur = () => {
    if (isKeyboardActiveRef.current) {
      if (refocusTimeoutRef.current) {
        clearTimeout(refocusTimeoutRef.current);
      }
      refocusTimeoutRef.current = setTimeout(() => {
        if (isKeyboardActiveRef.current && keyboardInputRef.current) {
          keyboardInputRef.current.focus();
        }
      }, 150);
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.value = " ";
  };

  useEffect(() => {
    if (keyboardInputRef.current) {
      keyboardInputRef.current.value = " ";
    }
    return () => {
      if (refocusTimeoutRef.current) {
        clearTimeout(refocusTimeoutRef.current);
      }
    };
  }, []);

  const triggerMobileKeyboard = () => {
    if (keyboardInputRef.current) {
      if (isKeyboardActiveRef.current) {
        isKeyboardActiveRef.current = false;
        keyboardInputRef.current.blur();
        const bridge = (window as any).AndroidBridge;
        if (bridge && typeof bridge.hideKeyboard === 'function') {
          try {
            bridge.hideKeyboard();
          } catch (e) {}
        }
      } else {
        isKeyboardActiveRef.current = true;
        keyboardInputRef.current.focus();
        setTimeout(() => {
          const bridge = (window as any).AndroidBridge;
          if (bridge && typeof bridge.showKeyboard === 'function') {
            try {
              bridge.showKeyboard();
            } catch (e) {
              console.error("Error calling AndroidBridge.showKeyboard:", e);
            }
          }
        }, 100);
      }
    }
  };

  const preventPropagation = (e: React.SyntheticEvent | React.TouchEvent | React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
  };

  const stopPropagationProps = {
    onPointerDown: preventPropagation,
    onPointerUp: preventPropagation,
    onPointerMove: preventPropagation,
    onMouseDown: preventPropagation,
    onMouseUp: preventPropagation,
    onClick: preventPropagation,
    onTouchStart: preventPropagation,
    onTouchMove: preventPropagation,
    onTouchEnd: preventPropagation,
  };

  return (
    <div 
      className={`screen-viewer ${platform === 'windows' ? 'platform-windows' : 'platform-android'} ${isFullscreen ? 'fullscreen' : ''}`}
      style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%', 
        width: '100%', 
        position: 'relative',
        overflow: 'hidden' // Clip scaled content
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {stream ? (
        <>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline
            muted
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              touchAction: 'none',
              transform: `scale(${scaleRef.current}) translate(${positionRef.current.x}px, ${positionRef.current.y}px)`,
              transformOrigin: 'center center',
              transition: scaleRef.current === 1 ? 'transform 0.2s ease-out' : 'none'
            }}
            onPointerDown={(e) => handlePointerEvent(e, 'down')}
            onPointerUp={(e) => handlePointerEvent(e, 'up')}
            onPointerMove={(e) => handlePointerEvent(e, 'move')}
            onWheel={handleWheelEvent}
            onContextMenu={(e) => e.preventDefault()}
          />

          {/* Hidden Input for Mobile Keyboard */}
          <input
            ref={keyboardInputRef}
            type="text"
            onChange={handleKeyboardInput}
            onKeyDown={handleKeyboardKeyDown}
            onBlur={handleInputBlur}
            onFocus={handleInputFocus}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              width: '30px',
              height: '30px',
              opacity: 0.01,
              border: 'none',
              background: 'transparent',
              color: 'transparent',
              pointerEvents: 'auto',
              zIndex: 1000
            }}
          />

          {/* Mobile Floating Overlay Controls (visible only on mobile) */}
          <div className="mobile-controls-bar" style={{ display: 'none' }} {...stopPropagationProps}>
            <button 
              className="mobile-control-btn"
              onClick={triggerMobileKeyboard}
              title="Teclado"
            >
              <Keyboard size={20} />
            </button>
            <button 
              className={`mobile-control-btn ${isRightClickMode ? 'active' : ''}`}
              onClick={() => setIsRightClickMode(!isRightClickMode)}
              title="Clic Derecho"
            >
              <MousePointer size={20} />
            </button>
            <button 
              className="mobile-control-btn"
              onClick={() => onMouseEvent('wheel', 120, 0)}
              title="Scroll Arriba"
            >
              <ChevronUp size={20} />
            </button>
            <button 
              className="mobile-control-btn"
              onClick={() => onMouseEvent('wheel', -120, 0)}
              title="Scroll Abajo"
            >
              <ChevronDown size={20} />
            </button>
            <button 
              className="mobile-control-btn"
              onClick={handleMobilePaste}
              title="Pegar"
            >
              <Clipboard size={20} />
            </button>
            {onDisconnect && (
              <button 
                className="mobile-control-btn"
                onClick={onDisconnect}
                style={{ color: '#ef4444' }}
                title="Desconectar"
              >
                <XCircle size={20} />
              </button>
            )}
          </div>

          {platform === 'windows' && (
            <button
              {...stopPropagationProps}
              onClick={(e) => { e.stopPropagation(); if (onKeyEvent) onKeyEvent('SEND_SAS'); }}
              className="sas-btn"
              title="Enviar Ctrl+Alt+Supr"
            >
              <Keyboard size={16} />
              <span>Ctrl+Alt+Supr</span>
            </button>
          )}

          <button
            {...stopPropagationProps}
            onClick={(e) => { e.stopPropagation(); setIsFullscreen(!isFullscreen); }}
            className="fullscreen-toggle-btn"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </>
      ) : (
        <div className="placeholder">
          <MonitorPlay />
          <p>Esperando la transmisión de pantalla...</p>
        </div>
      )}
    </div>
  );
}
