import React, { useState, useEffect } from 'react';
import { Loader2, Trash2, ExternalLink, Calendar, RefreshCw, PlusCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserNotesHistory, deleteNoteFromHistory } from '../services/notesHistory';
import NoteDetail from './NoteDetail';

const HistoryList = ({ onStartNewSession }) => {
  const { currentUser } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchHistory = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    setError('');
    try {
      const data = await getUserNotesHistory(currentUser.uid);
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes history:', err);
      setError('Unable to load your notes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentUser?.uid]);

  const handleDeleteConfirm = async (noteId) => {
    if (!currentUser?.uid || !noteId) return;
    setDeletingId(noteId);
    try {
      await deleteNoteFromHistory(currentUser.uid, noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
      alert('Failed to delete note. Please try again.');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const formatDate = (note) => {
    if (note.generatedNotes?.date) return note.generatedNotes.date;
    if (note.createdAt?.seconds) {
      return new Date(note.createdAt.seconds * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return 'Recent';
  };

  // If a note is currently opened in detail view
  if (selectedNote) {
    return (
      <NoteDetail 
        note={selectedNote} 
        onBack={() => setSelectedNote(null)} 
      />
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="nc-history-container nc-center-loading">
        <Loader2 className="nc-spin" size={24} style={{ color: 'var(--nc-accent)' }} />
        <p className="nc-status" style={{ marginTop: 10 }}>Loading your notes…</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="nc-history-container nc-center-loading">
        <AlertCircle size={24} style={{ color: 'var(--nc-danger)' }} />
        <p className="nc-status" style={{ marginTop: 8, color: '#fca5a5' }}>{error}</p>
        <button 
          type="button" 
          onClick={fetchHistory} 
          className="nc-btn nc-btn-ghost" 
          style={{ marginTop: 12, width: 'auto' }}
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (notes.length === 0) {
    return (
      <div className="nc-history-container nc-center-loading">
        <div className="nc-empty-icon">📚</div>
        <h4 className="nc-empty-title">No notes yet</h4>
        <p className="nc-status">Your recorded meetings and classes will appear here.</p>
        <button 
          type="button" 
          onClick={onStartNewSession} 
          className="nc-btn nc-btn-primary" 
          style={{ marginTop: 14 }}
        >
          <PlusCircle size={15} /> Start New Session
        </button>
      </div>
    );
  }

  return (
    <div className="nc-history-container">
      {/* List Header */}
      <div className="nc-history-header">
        <span className="nc-history-count">{notes.length} {notes.length === 1 ? 'Note' : 'Notes'}</span>
        <button 
          type="button" 
          onClick={fetchHistory} 
          className="nc-btn-icon-tiny" 
          title="Refresh History"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Note Cards List */}
      <div className="nc-history-list">
        {notes.map(note => {
          const isClass = note.mode === 'class_notes' || note.sourceType === 'class_webinar';
          return (
            <div key={note.id} className="nc-history-card">
              <div className="nc-history-card-top">
                <span className="nc-history-card-icon">{isClass ? '📚' : '📋'}</span>
                <div className="nc-history-card-info">
                  <h4 className="nc-history-card-title">{note.title || (isClass ? 'Class / Webinar Notes' : 'Meeting Minutes')}</h4>
                  <div className="nc-history-card-meta">
                    <span className={`nc-history-badge ${isClass ? 'class' : 'mom'}`}>
                      {isClass ? 'Class / Webinar' : 'MOM'}
                    </span>
                    <span className="nc-history-date">
                      <Calendar size={11} /> {formatDate(note)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="nc-history-card-actions">
                <button 
                  type="button" 
                  onClick={() => setSelectedNote(note)}
                  className="nc-btn nc-btn-ghost nc-btn-sm"
                >
                  <ExternalLink size={13} /> Open
                </button>
                <button 
                  type="button" 
                  onClick={() => setConfirmDeleteId(note.id)}
                  disabled={deletingId === note.id}
                  className="nc-btn nc-btn-danger-ghost nc-btn-sm"
                  title="Delete Note"
                >
                  {deletingId === note.id ? <Loader2 size={13} className="nc-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog Modal */}
      {confirmDeleteId && (
        <div className="nc-modal-overlay">
          <div className="nc-modal-card">
            <h4 className="nc-modal-title">Delete this note?</h4>
            <p className="nc-modal-desc">This action cannot be undone.</p>
            <div className="nc-modal-actions">
              <button 
                type="button" 
                onClick={() => setConfirmDeleteId(null)} 
                className="nc-btn nc-btn-ghost nc-btn-sm"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={() => handleDeleteConfirm(confirmDeleteId)} 
                className="nc-btn nc-btn-danger nc-btn-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryList;
