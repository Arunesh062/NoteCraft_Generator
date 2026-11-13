import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar, TabType } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { NotesPage } from './pages/NotesPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthScreen } from './pages/AuthScreen';
import { AuthModal } from './components/AuthModal';
import { NoteDetailModal } from './components/NoteDetailModal';

import { useAuth } from './hooks/useAuth';
import { useRecording } from './hooks/useRecording';
import {
  getStoredNotes,
  saveStoredNotes,
  mergeCloudAndLocalNotes,
  deleteStoredNote,
  clearStoredNotes,
} from './services/historyService';
import {
  getDesktopNotesFromFirestore,
  syncLocalNotesToFirestore,
  deleteDesktopNoteFromFirestore,
  deleteAllDesktopNotesFromFirestore,
} from './services/firestoreService';
import { checkBackendHealth } from './services/apiService';
import { NoteItem } from './types/note';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const {
    user,
    status: authStatus,
    error: authError,
    loginWithEmail,
    signupWithEmail,
    loginWithGoogle,
    loginWithAnonymous,
    logout,
  } = useAuth();

  const handleDeleteNote = async (noteId: string): Promise<boolean> => {
    const currentUid = user?.uid || null;
    const isCloudUser = Boolean(currentUid && !user?.isAnonymous);

    try {
      if (isCloudUser && currentUid) {
        await deleteDesktopNoteFromFirestore(currentUid, noteId);
      }

      deleteStoredNote(noteId, currentUid);

      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }

      setDeleteStatus({ type: 'success', message: 'Note deleted.' });
      setTimeout(() => setDeleteStatus(null), 3500);
      return true;
    } catch (err: any) {
      console.error('[App] Failed to delete note:', err);
      setDeleteStatus({ type: 'error', message: err?.message || 'Failed to delete note. Please try again.' });
      setTimeout(() => setDeleteStatus(null), 4000);
      return false;
    }
  };

  const handleDeleteAllNotes = async (): Promise<boolean> => {
    const currentUid = user?.uid || null;
    const isCloudUser = Boolean(currentUid && !user?.isAnonymous);

    try {
      if (isCloudUser && currentUid) {
        await deleteAllDesktopNotesFromFirestore(currentUid);
      }

      clearStoredNotes(currentUid);

      setNotes([]);
      setSelectedNote(null);

      setDeleteStatus({ type: 'success', message: 'All your notes have been deleted.' });
      setTimeout(() => setDeleteStatus(null), 3500);
      return true;
    } catch (err: any) {
      console.error('[App] Failed to delete all notes:', err);
      setDeleteStatus({ type: 'error', message: err?.message || 'Failed to delete all notes. Please try again.' });
      setTimeout(() => setDeleteStatus(null), 4000);
      return false;
    }
  };

  const handleNoteCreated = (newNote: NoteItem) => {
    setNotes((prev) => [newNote, ...prev]);
  };

  const {
    meetingMode,
    setMeetingMode,
    recordingState,
    deviceStatus,
    audioLevels,
    durationFormatted,
    backendResult,
    errorMessage,
    uploadProgressText,
    isMicMuted,
    toggleMicMute,
    startRecording,
    stopRecording,
    resetRecordingState,
  } = useRecording(handleNoteCreated, user?.uid);

  const handleLogout = async () => {
    setSelectedNote(null);
    setNotes([]);
    setDeleteStatus(null);
    setShowSyncPrompt(false);
    resetRecordingState();
    await logout();
  };

  useEffect(() => {
    checkBackendHealth().then((status) => setBackendOnline(status.online));
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const currentUid = user?.uid || null;

    // Immediately clear displayed state when auth changes to prevent cross-user bleed
    setNotes([]);
    setSelectedNote(null);
    setShowSyncPrompt(false);

    const loadNotesForAuth = async () => {
      if (currentUid && !user?.isAnonymous) {
        // Authenticated Cloud User
        try {
          const cloudNotes = await getDesktopNotesFromFirestore(currentUid);
          if (isCancelled) return;

          const localNotes = getStoredNotes(currentUid);
          const mergedNotes = mergeCloudAndLocalNotes(cloudNotes, localNotes);

          if (!isCancelled) {
            setNotes(mergedNotes);
            saveStoredNotes(mergedNotes, currentUid);
          }
        } catch (err) {
          console.warn('Failed to load cloud notes, using local fallback:', err);
          if (!isCancelled) {
            const localNotes = getStoredNotes(currentUid);
            setNotes(localNotes);
          }
        }

        // Check if un-synced guest notes exist
        if (!isCancelled) {
          const guestNotes = getStoredNotes(null);
          if (guestNotes.length > 0) {
            setShowSyncPrompt(true);
          }
        }
      } else if (currentUid) {
        // Explicit Guest User
        if (!isCancelled) {
          const guestNotes = getStoredNotes(null);
          setNotes(guestNotes);
        }
      }
    };

    if (user) {
      loadNotesForAuth();
    }

    return () => {
      isCancelled = true;
    };
  }, [user]);

  const handleSyncLocalNotes = async () => {
    if (!user || !user.uid || user.isAnonymous) return;
    try {
      setIsSyncing(true);
      const guestNotes = getStoredNotes(null);
      if (guestNotes.length > 0) {
        await syncLocalNotesToFirestore(user.uid, guestNotes);
        saveStoredNotes([], null); // Clear guest notes after explicit sync
      }
      const cloudNotes = await getDesktopNotesFromFirestore(user.uid);
      const localNotes = getStoredNotes(user.uid);
      const mergedNotes = mergeCloudAndLocalNotes(cloudNotes, localNotes);
      setNotes(mergedNotes);
      saveStoredNotes(mergedNotes, user.uid);
      setShowSyncPrompt(false);
    } catch (err) {
      console.warn('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Auth Gate: Initializing State
  if (authStatus === 'loading') {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-background)',
          color: 'var(--color-text-primary)',
        }}
      >
        <div className="logo-icon" style={{ marginBottom: '16px', transform: 'scale(1.4)' }}>
          <Sparkles size={36} color="#FFFFFF" />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '12px' }}>NoteCraft Desktop</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          <Loader2 className="animate-spin" size={18} color="#0F766E" />
          <span>Initializing authentication state...</span>
        </div>
      </div>
    );
  }

  // Auth Gate: Unauthenticated Screen
  if (authStatus === 'unauthenticated' || !user) {
    return (
      <AuthScreen
        onEmailLogin={async (email, pass) => {
          await loginWithEmail(email, pass);
        }}
        onEmailSignup={async (email, pass, name) => {
          await signupWithEmail(email, pass, name);
        }}
        onGoogleLogin={loginWithGoogle}
        onAnonymousLogin={loginWithAnonymous}
        error={authError}
        backendOnline={backendOnline}
      />
    );
  }

  return (
    <div className="app-layout">
      <Header
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        backendOnline={backendOnline}
      />

      <div className="main-body">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          noteCount={notes.length}
        />

        <main className="content-area">
          {deleteStatus && (
            <div
              className="info-callout"
              style={{
                borderColor: deleteStatus.type === 'success' ? '#14B8A6' : '#EF4444',
                background: deleteStatus.type === 'success' ? 'rgba(20, 184, 166, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: deleteStatus.type === 'success' ? '#14B8A6' : '#EF4444',
                marginBottom: '12px',
                fontWeight: 600,
              }}
            >
              <span>{deleteStatus.message}</span>
            </div>
          )}

          {showSyncPrompt && user && !user.isAnonymous && (
            <div
              className="info-callout"
              style={{
                borderColor: '#0F766E',
                background: 'rgba(15, 118, 110, 0.12)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <RefreshCw size={18} color="#0F766E" />
                <span style={{ color: 'var(--color-text-primary)' }}>Sync local guest notes to your NoteCraft cloud account?</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="user-btn"
                  style={{ padding: '6px 14px', background: '#0F766E', color: '#FFFFFF', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  onClick={handleSyncLocalNotes}
                  disabled={isSyncing}
                >
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <button
                  className="btn-stop"
                  style={{ padding: '6px 14px', borderRadius: '6px' }}
                  onClick={() => setShowSyncPrompt(false)}
                >
                  Not Now
                </button>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardPage
              user={user}
              meetingMode={meetingMode}
              onSelectMode={setMeetingMode}
              recordingState={recordingState}
              durationFormatted={durationFormatted}
              deviceStatus={deviceStatus}
              audioLevels={audioLevels}
              backendResult={backendResult}
              errorMessage={errorMessage}
              uploadProgressText={uploadProgressText}
              isMicMuted={isMicMuted}
              onToggleMicMute={toggleMicMute}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              notes={notes}
              onSelectNote={setSelectedNote}
              onDeleteNote={handleDeleteNote}
              onDeleteAllNotes={handleDeleteAllNotes}
            />
          )}

          {activeTab === 'notes' && (
            <NotesPage
              notes={notes}
              onSelectNote={setSelectedNote}
              onDeleteNote={handleDeleteNote}
              onDeleteAllNotes={handleDeleteAllNotes}
              onNavigateToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              user={user}
              onLogout={handleLogout}
              noteCount={notes.length}
              meetingMode={meetingMode}
              onSelectMeetingMode={setMeetingMode}
              onSyncLocalNotes={showSyncPrompt ? handleSyncLocalNotes : undefined}
              onDeleteAllNotes={handleDeleteAllNotes}
              backendOnline={backendOnline}
              deviceStatus={deviceStatus}
              recordingState={recordingState}
            />
          )}
        </main>
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onEmailLogin={async (email, pass) => {
          await loginWithEmail(email, pass);
        }}
        onEmailSignup={async (email, pass, name) => {
          await signupWithEmail(email, pass, name);
        }}
        onGoogleLogin={loginWithGoogle}
        onAnonymousLogin={loginWithAnonymous}
        error={authError}
      />

      <NoteDetailModal
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onDeleteNote={handleDeleteNote}
      />
    </div>
  );
};

export default App;
