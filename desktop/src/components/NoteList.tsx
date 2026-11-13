import React, { useState } from 'react';
import { FileText, Calendar, Clock, ArrowRight, Trash2, AlertTriangle, Loader2, X, Mic } from 'lucide-react';
import { NoteItem } from '../types/note';

interface NoteListProps {
  notes: NoteItem[];
  onSelectNote: (note: NoteItem) => void;
  onDeleteNote?: (noteId: string) => Promise<boolean>;
  onDeleteAllNotes?: () => Promise<boolean>;
  onNavigateToDashboard?: () => void;
}

export const NoteList: React.FC<NoteListProps> = ({
  notes,
  onSelectNote,
  onDeleteNote,
  onDeleteAllNotes,
  onNavigateToDashboard,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'mom' | 'class_notes'>('all');

  // Deletion modal state
  const [noteToDelete, setNoteToDelete] = useState<NoteItem | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredNotes = notes.filter((note) => {
    const matchesMode = filterMode === 'all' || note.meetingMode === filterMode;
    const matchesSearch =
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesMode && matchesSearch;
  });

  const handleConfirmDeleteSingle = async () => {
    if (!noteToDelete || !onDeleteNote) return;
    try {
      setIsDeleting(true);
      await onDeleteNote(noteToDelete.id);
      setNoteToDelete(null);
    } catch (err) {
      console.error('Error in single note delete handler:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteAll = async () => {
    if (!onDeleteAllNotes) return;
    try {
      setIsDeleting(true);
      await onDeleteAllNotes();
      setShowDeleteAllConfirm(false);
    } catch (err) {
      console.error('Error in delete all notes handler:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="glass-card">
      <div className="notes-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="card-title">
            <FileText size={18} color="#0F766E" />
            <span>Note History & Transcripts</span>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500, marginLeft: '6px' }}>
              ({notes.length} {notes.length === 1 ? 'note' : 'notes'})
            </span>
          </div>
          <div className="card-desc">Saved meeting minutes and lecture notes</div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {notes.length > 0 && onDeleteAllNotes && (
            <button
              className="user-btn"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
              }}
              onClick={() => setShowDeleteAllConfirm(true)}
              title="Delete all history for current account"
            >
              <Trash2 size={14} />
              <span>Delete All</span>
            </button>
          )}

          <select
            className="search-input"
            style={{ width: '120px', cursor: 'pointer' }}
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as any)}
          >
            <option value="all">All Modes</option>
            <option value="mom">MOM Only</option>
            <option value="class_notes">Class Notes</option>
          </select>

          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search notes..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {filteredNotes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--color-text-secondary)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={24} color="#0F766E" />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {notes.length === 0 ? 'No notes yet' : 'No matching notes found'}
          </div>
          <div style={{ fontSize: '13px', maxWidth: '360px', color: 'var(--color-text-secondary)' }}>
            {notes.length === 0
              ? 'Your generated meeting and class notes will appear here after recording.'
              : 'Try clearing your search term or selecting a different template filter.'}
          </div>
          {notes.length === 0 && onNavigateToDashboard && (
            <button
              className="user-btn"
              style={{
                marginTop: '8px',
                background: 'var(--gradient-primary)',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 18px',
                fontWeight: 700,
              }}
              onClick={onNavigateToDashboard}
            >
              <Mic size={15} />
              <span>Start Recording</span>
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredNotes.map((note) => (
            <div key={note.id} className="note-card" onClick={() => onSelectNote(note)}>
              <div className="note-title-row">
                <span className="note-title">{note.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className="mode-pill"
                    style={{
                      background:
                        note.meetingMode === 'mom'
                          ? 'rgba(15, 118, 110, 0.12)'
                          : 'rgba(45, 212, 191, 0.18)',
                      color: '#0F766E',
                      fontWeight: 700,
                    }}
                  >
                    {note.meetingMode === 'mom' ? 'MOM' : 'CLASS NOTES'}
                  </span>

                  {onDeleteNote && (
                    <button
                      className="btn-delete-icon"
                      title="Delete note"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNoteToDelete(note);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#EF4444';
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                        e.currentTarget.style.background = 'none';
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="note-meta">
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={13} />
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={13} />
                  {note.duration}
                </span>
              </div>

              <p className="note-summary">{note.summary}</p>

              <div className="note-footer">
                <div className="tag-list">
                  {note.tags.map((tag) => (
                    <span key={tag} className="tag-pill">
                      #{tag}
                    </span>
                  ))}
                </div>

                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 600,
                  }}
                >
                  View Note <ArrowRight size={14} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal 1: Single Note Deletion */}
      {noteToDelete && (
        <div className="modal-overlay" onClick={() => !isDeleting && setNoteToDelete(null)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444' }}>
                <Trash2 size={20} />
                <span className="modal-title" style={{ color: 'var(--color-text-primary)' }}>Delete Note?</span>
              </div>
              <button className="btn-close" onClick={() => !isDeleting && setNoteToDelete(null)} disabled={isDeleting}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
              Are you sure you want to permanently delete{' '}
              <strong style={{ color: 'var(--color-text-primary)' }}>"{noteToDelete.title}"</strong>?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                className="btn-stop"
                style={{ padding: '8px 16px', fontSize: '13px' }}
                onClick={() => setNoteToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="user-btn"
                style={{
                  background: '#EF4444',
                  borderColor: '#EF4444',
                  color: '#FFFFFF',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={handleConfirmDeleteSingle}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal 2: Delete All History */}
      {showDeleteAllConfirm && (
        <div className="modal-overlay" onClick={() => !isDeleting && setShowDeleteAllConfirm(false)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '460px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 10px 30px rgba(239, 68, 68, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#EF4444' }}>
                <AlertTriangle size={22} color="#EF4444" />
                <span className="modal-title" style={{ color: 'var(--color-text-primary)' }}>Delete All History?</span>
              </div>
              <button className="btn-close" onClick={() => !isDeleting && setShowDeleteAllConfirm(false)} disabled={isDeleting}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '12px 14px', borderRadius: '8px', borderLeft: '4px solid #EF4444' }}>
              <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: '1.5', fontWeight: 600 }}>
                This will permanently delete all notes in your current account/history.
              </p>
              <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px', fontWeight: 700 }}>
                This action cannot be undone.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                className="btn-stop"
                style={{ padding: '8px 16px', fontSize: '13px' }}
                onClick={() => setShowDeleteAllConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="user-btn"
                style={{
                  background: '#EF4444',
                  borderColor: '#EF4444',
                  color: '#FFFFFF',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                }}
                onClick={handleConfirmDeleteAll}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                <span>{isDeleting ? 'Deleting All...' : 'Delete All'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
