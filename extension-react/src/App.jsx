/**
 * NoteCraft AI — Floating Widget & Popup Component
 *
 * Architecture decisions:
 * ─────────────────────────────────────────────────────────────────
 * 1. FIREBASE AUTH WRAPPER — AuthProvider wraps AppMain so auth state is
 *    resolved cleanly before rendering the main application.
 *
 * 2. FIRESTORE NOTE HISTORY — Authenticated users automatically save
 *    generated notes to Firestore and can view, open, and delete them
 *    via the "My Notes" tab.
 *
 * 3. SINGLE JSX TREE — both FAB and expanded card are always in the
 *    DOM; visibility is toggled by CSS class only.
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Download, RefreshCw, Minus, Loader2, X, LogOut, Clock, FileText, AlertTriangle } from 'lucide-react';
import { BACKEND_URL } from '../config.js';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Signup from './components/Signup';
import HistoryList from './components/HistoryList';
import { saveNoteToHistory } from './services/notesHistory';

/* ── helpers ──────────────────────────────────────────────────── */

const DEFAULT_POS = { top: 120, left: 120 };

/** Return a position object guaranteed to have numeric top & left. */
function safePos(pos) {
  if (!pos || typeof pos !== 'object') return { ...DEFAULT_POS };
  const top  = typeof pos.top  === 'number' && isFinite(pos.top)  ? Math.max(0, pos.top)  : DEFAULT_POS.top;
  const left = typeof pos.left === 'number' && isFinite(pos.left) ? Math.max(0, pos.left) : DEFAULT_POS.left;
  return { top, left };
}

const mapStateToScreen = (state) => {
  if (!state) return 'start';
  if (state === 'idle') return 'start';
  if (state === 'ready') return 'complete';
  return state;
};

/* ── Inner App Main component ─────────────────────────────────── */

const AppMain = ({ mode = 'popup' }) => {
  const { currentUser, loading, logout } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' | 'signup'

  /* ── state ── */
  const [activeTab,      setActiveTab]      = useState('session'); // session | history
  const [screen,         setScreen]         = useState('start');   // start | recording | processing | complete
  const [timer,          setTimer]          = useState('00:00');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isMinimized,    setIsMinimized]    = useState(false);
  const [position,       setPosition]       = useState(DEFAULT_POS);
  const [sessionId,      setSessionId]      = useState(null);
  const [transcript,     setTranscript]     = useState('');
  const [downloadUrl,    setDownloadUrl]    = useState('');
  const [isVisible,      setIsVisible]      = useState(true);
  const [selectedMode,   setSelectedMode]   = useState('mom');     // mom | class_notes
  const [saveError,      setSaveError]      = useState('');

  /* ── refs (immune to render cycles) ── */
  const posRef          = useRef(DEFAULT_POS); // always reflects latest position
  const timerRef        = useRef(null);
  const didDragRef      = useRef(false);       // true if pointer moved > threshold during a mousedown
  const isMinRef        = useRef(false);       // mirrors isMinimized so drag handlers see current value
  const savedSessionRef = useRef(null);        // prevents duplicate Firestore saves

  /* keep refs in sync with state */
  useEffect(() => { posRef.current    = position;    }, [position]);
  useEffect(() => { isMinRef.current  = isMinimized; }, [isMinimized]);

  /* ── format ── */
  const formatTime = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return mode === 'popup' ? `${h}:${m}:${sec}` : `${m}:${sec}`;
  };

  /* ── Chrome Storage sync ── */
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) return;

    chrome.storage.local.get(
      ['currentState', 'elapsedSeconds', 'nc_minimized', 'nc_pos', 'currentSession', 'transcript', 'downloadUrl', 'nc_visible', 'selectedMode'],
      (data) => {
        setScreen(mapStateToScreen(data.currentState));
        const sec = data.elapsedSeconds || 0;
        setElapsedSeconds(sec);
        setTimer(formatTime(sec));
        setIsMinimized(data.nc_minimized || false);
        setSessionId(data.currentSession || null);
        setTranscript(data.transcript || '');
        setDownloadUrl(data.downloadUrl || '');
        setIsVisible(data.nc_visible !== false);
        setSelectedMode(data.selectedMode || 'mom');
        if (data.nc_pos) {
          const p = safePos(data.nc_pos);
          posRef.current = p;
          setPosition(p);
        }
      }
    );

    const onStorageChange = (changes) => {
      if (changes.currentState && ['recording', 'processing', 'ready'].includes(changes.currentState.newValue)) {
        setIsVisible(true);
      }

      if (changes.currentState) {
        setScreen(mapStateToScreen(changes.currentState.newValue));
      }
      if (changes.elapsedSeconds) {
        const sec = changes.elapsedSeconds.newValue || 0;
        setElapsedSeconds(sec);
        setTimer(formatTime(sec));
      }
      if (changes.nc_minimized) {
        setIsMinimized(changes.nc_minimized.newValue !== undefined ? Boolean(changes.nc_minimized.newValue) : false);
      }
      if (changes.nc_visible) {
        setIsVisible(changes.nc_visible.newValue !== false);
      }
      if (changes.currentSession) {
        setSessionId(changes.currentSession.newValue || null);
      }
      if (changes.transcript) {
        setTranscript(changes.transcript.newValue || '');
      }
      if (changes.downloadUrl) {
        setDownloadUrl(changes.downloadUrl.newValue || '');
      }
      if (changes.selectedMode) {
        setSelectedMode(changes.selectedMode.newValue || 'mom');
      }
      if (changes.nc_pos) {
        const p = safePos(changes.nc_pos.newValue);
        posRef.current = p;
        setPosition(p);
      }
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, []);

  /* ── Automatic Firestore note saving on successful generation ── */
  useEffect(() => {
    if ((screen === 'complete' || screen === 'ready') && currentUser?.uid && sessionId) {
      if (savedSessionRef.current === sessionId) return;

      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        chrome.storage.local.get(['generatedNotes', 'selectedMode'], async (data) => {
          const notes = data.generatedNotes || {};
          const modeToSave = data.selectedMode || selectedMode || 'mom';
          try {
            savedSessionRef.current = sessionId;
            setSaveError('');
            await saveNoteToHistory(currentUser.uid, sessionId, modeToSave, notes);
            console.log('✅ Note automatically saved to Firestore history for user:', currentUser.uid);
          } catch (err) {
            console.error('❌ Firestore note save error:', err);
            setSaveError("Your notes were generated, but we couldn't save them to history.");
          }
        });
      }
    }
  }, [screen, currentUser?.uid, sessionId]);

  /* ── mode change handler ── */
  const handleModeChange = (newMode) => {
    if (screen !== 'start' && screen !== 'idle') return;
    setSelectedMode(newMode);
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ selectedMode: newMode });
    }
  };

  /* ── timer ── */
  useEffect(() => {
    if (screen === 'recording') {
      timerRef.current = setInterval(
        () => {
          setElapsedSeconds(prev => {
            const next = prev + 1;
            setTimer(formatTime(next));
            return next;
          });
        },
        1000
      );
    } else {
      clearInterval(timerRef.current);
      if (screen === 'start' || screen === 'idle') {
        setElapsedSeconds(0);
        setTimer("00:00");
      }
    }
    return () => clearInterval(timerRef.current);
  }, [screen]);

  /* ── recording actions ── */
  const handleStart = () => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ selectedMode });
    }

    if (mode === 'popup') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'START_RECORDING' });
      });
    } else {
      window.dispatchEvent(new CustomEvent('nc-start-recording'));
    }
  };

  const handleStop = () => {
    if (mode === 'popup') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'STOP_RECORDING' });
      });
    } else {
      window.dispatchEvent(new CustomEvent('nc-stop-recording'));
    }
  };

  const handleDownload = () => {
    chrome.storage.local.get(['currentSession'], (data) => {
      window.open(`${BACKEND_URL}/download/${data.currentSession}`, '_blank');
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      setAuthView('login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const resetSession = () => {
    setScreen("start");
    setTimer("00:00");
    setTranscript("");
    setDownloadUrl("");
    setSessionId(null);
    setIsMinimized(false);
    setSelectedMode("mom");
    setSaveError("");
    savedSessionRef.current = null;
    setActiveTab("session");

    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.remove([
        'currentState',
        'currentSession',
        'elapsedSeconds',
        'transcript',
        'downloadUrl',
        'nc_minimized',
        'generatedNotes'
      ], () => {
        chrome.storage.local.set({
          currentState: 'idle',
          nc_minimized: false,
          selectedMode: 'mom'
        });
      });
    }

    window.dispatchEvent(new CustomEvent('nc-session-reset'));
  };

  const closeWidget = () => {
    resetSession();
    setIsVisible(false);
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ nc_visible: false });
    }
  };

  const toggleMinimize = (e) => {
    e.stopPropagation();
    if (didDragRef.current) return;
    const next = !isMinRef.current;
    setIsMinimized(next);
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ nc_minimized: next });
    }
  };

  const makeDragHandler = () => (e) => {
    if (mode !== 'widget') return;
    e.preventDefault();
    e.stopPropagation();

    const startX    = e.clientX;
    const startY    = e.clientY;
    const startTop  = posRef.current.top;
    const startLeft = posRef.current.left;
    didDragRef.current = false;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        didDragRef.current = true;
      }

      const newPos = safePos({ top: startTop + dy, left: startLeft + dx });
      posRef.current = newPos;
      setPosition(newPos);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);

      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        chrome.storage.local.set({ nc_pos: posRef.current });
      }

      setTimeout(() => { didDragRef.current = false; }, 0);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  };

  const fabDragHandler    = useRef(makeDragHandler()).current;
  const headerDragHandler = useRef(makeDragHandler()).current;

  const pos = safePos(position);
  const widgetStyle = mode === 'widget'
    ? { position: 'fixed', top: pos.top, left: pos.left, zIndex: 2147483647 }
    : {};

  const isRecordingScreen = screen === 'recording';

  if (mode === 'widget' && !isVisible) {
    return null;
  }

  // 1. Loading state while Firebase auth is resolving
  if (loading) {
    return (
      <div className="nc-widget" style={widgetStyle}>
        <div className="nc-header">
          <div className="nc-logo-group">
            <div className="nc-dot" />
            <span className="nc-title">NoteCraft AI</span>
          </div>
        </div>
        <div className="nc-body nc-center-loading">
          <Loader2 className="nc-spin" size={24} style={{ color: 'var(--nc-accent)' }} />
          <p className="nc-status" style={{ marginTop: 10 }}>Resolving session…</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated state -> render Login or Signup screen
  if (!currentUser) {
    return (
      <div className="nc-widget" style={widgetStyle}>
        <div className="nc-header">
          <div className="nc-logo-group">
            <div className="nc-dot" />
            <span className="nc-title">NoteCraft AI</span>
          </div>
          {mode === 'widget' && (
            <div className="nc-actions">
              <button className="nc-action-btn nc-close-btn" onClick={closeWidget} title="Close NoteCraft">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="nc-body">
          {authView === 'login' ? (
            <Login onSwitchToSignup={() => setAuthView('signup')} />
          ) : (
            <Signup onSwitchToLogin={() => setAuthView('login')} />
          )}
        </div>
      </div>
    );
  }

  // 3. Authenticated state -> render main NoteCraft application
  return (
    <>
      {/* ── MINIMISED FAB BUBBLE ─────────────────────────────── */}
      {mode === 'widget' && (
        <div
          className={[
            'nc-fab',
            isMinimized        ? 'nc-fab--visible'    : 'nc-fab--hidden',
            isRecordingScreen  ? 'nc-fab--recording' : '',
          ].join(' ')}
          style={{ top: pos.top, left: pos.left }}
          onMouseDown={fabDragHandler}
          onClick={toggleMinimize}
          title="Expand NoteCraft"
          aria-label="NoteCraft AI — click to expand"
        >
          {isRecordingScreen && <div className="nc-fab-ring" />}
          <div className="nc-fab-dot" />
          <span className="nc-fab-timer">{timer}</span>
        </div>
      )}

      {/* ── EXPANDED WIDGET CARD ─────────────────────────────── */}
      <div
        className={[
          'nc-widget',
          isRecordingScreen                           ? 'recording'    : '',
          mode === 'widget' && isMinimized            ? 'nc-widget--hidden' : '',
        ].join(' ')}
        style={widgetStyle}
      >
        {/* Header — drag handle & user account info */}
        <div
          className="nc-header"
          onMouseDown={mode === 'widget' ? headerDragHandler : undefined}
        >
          <div className="nc-logo-group">
            <div className="nc-dot" />
            <span className="nc-title">NoteCraft AI</span>
          </div>
          <div className="nc-actions">
            <div className="nc-user-info" title={currentUser.email || ''}>
              <span className="nc-user-name">
                👤 {currentUser.displayName || currentUser.email?.split('@')[0] || 'User'}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="nc-logout-btn"
                title="Logout"
              >
                <LogOut size={13} />
              </button>
            </div>
            {mode === 'widget' && (
              <>
                <button
                  className="nc-action-btn"
                  onClick={toggleMinimize}
                  title="Minimise"
                >
                  <Minus size={14} />
                </button>
                <button
                  className="nc-action-btn nc-close-btn"
                  onClick={closeWidget}
                  title="Close NoteCraft"
                >
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Navigation Tab Bar */}
        <div className="nc-nav-tabs">
          <button
            type="button"
            className={`nc-nav-tab ${activeTab === 'session' ? 'active' : ''}`}
            onClick={() => setActiveTab('session')}
          >
            <FileText size={13} /> New Session
          </button>
          <button
            type="button"
            className={`nc-nav-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Clock size={13} /> My Notes
          </button>
        </div>

        {/* Body */}
        <div className="nc-body">
          {activeTab === 'history' ? (
            <HistoryList onStartNewSession={() => { resetSession(); setActiveTab('session'); }} />
          ) : (
            <>
              {(screen === 'start' || screen === 'idle' || !['recording', 'processing', 'complete', 'ready'].includes(screen)) && (
                <div className="nc-content">
                  <div className="nc-mode-selector">
                    <span className="nc-mode-label">Select Output Mode</span>
                    <div className="nc-mode-options">
                      <button
                        type="button"
                        className={`nc-mode-card ${selectedMode === 'mom' ? 'active' : ''}`}
                        onClick={() => handleModeChange('mom')}
                      >
                        <div className="nc-mode-title">MOM</div>
                        <div className="nc-mode-desc">Meeting Minutes</div>
                      </button>
                      <button
                        type="button"
                        className={`nc-mode-card ${selectedMode === 'class_notes' ? 'active' : ''}`}
                        onClick={() => handleModeChange('class_notes')}
                      >
                        <div className="nc-mode-title">CLASS / WEBINAR</div>
                        <div className="nc-mode-desc">Detailed Notes</div>
                      </button>
                    </div>
                  </div>
                  <button onClick={handleStart} className="nc-btn nc-btn-primary">
                    <Play size={16} /> Start Recording
                  </button>
                </div>
              )}

              {screen === 'recording' && (
                <div className="nc-content">
                  <div className="nc-recording-badge">● Live Recording</div>
                  <div className="nc-recording-mode-indicator">
                    <span className="nc-recording-mode-icon">
                      {selectedMode === 'class_notes' ? '📚' : '📋'}
                    </span>
                    <div className="nc-recording-mode-text">
                      <div className="nc-recording-mode-title">
                        {selectedMode === 'class_notes' ? 'CLASS / WEBINAR' : 'MOM'}
                      </div>
                      <div className="nc-recording-mode-desc">
                        {selectedMode === 'class_notes' ? 'Detailed Notes' : 'Meeting Minutes'}
                      </div>
                    </div>
                  </div>
                  <div className="nc-timer">{timer}</div>
                  <button onClick={handleStop} className="nc-btn nc-btn-danger">
                    <Square size={16} /> {selectedMode === 'class_notes' ? 'Stop Recording' : 'Stop Meeting'}
                  </button>
                </div>
              )}

              {screen === 'processing' && (
                <div className="nc-content">
                  <p className="nc-title-text">Orchestrating Notes</p>
                  <div className="nc-progress-container">
                    <div className="nc-progress-bar">
                      <div className="nc-progress-inner" />
                    </div>
                  </div>
                  <p className="nc-status">Synthesising AI insights…</p>
                  <Loader2 className="nc-spin" style={{ margin: '8px auto', display: 'block' }} />
                </div>
              )}

              {(screen === 'complete' || screen === 'ready') && (
                <div className="nc-content">
                  <p className="nc-title-text" style={{ color: '#10b981' }}>
                    ✓ {selectedMode === 'class_notes' ? 'Class / Webinar Notes Ready!' : 'Meeting Minutes Ready!'}
                  </p>
                  <div className="nc-type-badge">
                    Type: {selectedMode === 'class_notes' ? 'Class / Webinar Notes' : 'Meeting Minutes'}
                  </div>

                  {saveError && (
                    <div className="nc-auth-error-banner" style={{ margin: '8px 0', fontSize: '11px' }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                      <span>{saveError}</span>
                    </div>
                  )}

                  <button onClick={handleDownload} className="nc-btn nc-btn-success">
                    <Download size={16} /> Download DOCX
                  </button>
                  <button onClick={resetSession} className="nc-btn nc-btn-ghost">
                    <RefreshCw size={14} /> New Session
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

/* ── App wrapper with AuthProvider ────────────────────────────── */
const App = ({ mode = 'popup' }) => {
  return (
    <AuthProvider>
      <AppMain mode={mode} />
    </AuthProvider>
  );
};

export default App;
