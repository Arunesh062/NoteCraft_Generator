import React, { useState } from 'react';
import { X, Calendar, Clock, Download, CheckSquare, Sparkles, BookOpen, Code, HelpCircle, Lightbulb, Users, ListChecks, Trash2, Loader2 } from 'lucide-react';
import { NoteItem } from '../types/note';
import { API_BASE_URL } from '../services/apiService';

interface NoteDetailModalProps {
  note: NoteItem | null;
  onClose: () => void;
  onDeleteNote?: (noteId: string) => Promise<boolean>;
}

export const NoteDetailModal: React.FC<NoteDetailModalProps> = ({ note, onClose, onDeleteNote }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!note) return null;

  const docxUrl = note.docxUrl
    ? note.docxUrl.startsWith('http')
      ? note.docxUrl
      : `${API_BASE_URL}${note.docxUrl.startsWith('/') ? '' : '/'}${note.docxUrl}`
    : null;

  const notesData = note.notesData || {};
  const isClassNotes = note.meetingMode === 'class_notes' || notesData.document_type === 'class_notes';

  const handleDownloadDocx = async (e: React.MouseEvent) => {
    if (!docxUrl) return;
    try {
      const res = await fetch(docxUrl, { method: 'HEAD' }).catch(() => null);
      if (res && !res.ok) {
        e.preventDefault();
        alert(`Unable to download DOCX (HTTP ${res.status}). The file may no longer be available on the backend.`);
        return;
      }
    } catch (err) {
      console.warn('DOCX download check notice:', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '720px', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#0F766E" />
            <span className="modal-title" style={{ color: 'var(--color-text-primary)' }}>{note.title}</span>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={14} /> {new Date(note.createdAt).toLocaleString()}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={14} /> {note.duration}
          </span>
          <span
            className="mode-pill"
            style={{
              textTransform: 'uppercase',
              background: 'rgba(15, 118, 110, 0.12)',
              color: '#0F766E',
              fontWeight: 700,
            }}
          >
            {isClassNotes ? 'Class / Webinar Notes' : 'Minutes of Meeting'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary / Overview */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BookOpen size={16} color="#0F766E" />
              {isClassNotes ? 'Class / Session Overview' : 'Executive Summary'}
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
              {notesData.overview || note.summary}
            </p>
          </div>

          {/* Members / Instructor */}
          {isClassNotes && notesData.speaker_instructor && (
            <div>
              <h5 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                Speaker / Instructor:
              </h5>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{notesData.speaker_instructor}</p>
            </div>
          )}

          {!isClassNotes && (notesData.members_present || notesData.participants) && (
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} color="#0F766E" /> Members Present
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(Array.isArray(notesData.members_present) ? notesData.members_present : Array.isArray(notesData.participants) ? notesData.participants : [notesData.members_present || notesData.participants]).map((m: any, idx: number) => (
                  <span key={idx} className="mode-pill" style={{ background: 'rgba(15, 118, 110, 0.12)', color: '#0F766E' }}>
                    {typeof m === 'string' ? m : m.name || JSON.stringify(m)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Topics Covered / Key Topics */}
          {((isClassNotes && notesData.topics_covered) || note.keyTopics) && (
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
                {isClassNotes ? 'Topics Covered' : 'Key Discussion Topics'}
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(isClassNotes && Array.isArray(notesData.topics_covered) ? notesData.topics_covered : note.keyTopics || []).map((topic: string) => (
                  <span key={topic} className="mode-pill" style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}>
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Notes (Class Notes Mode) */}
          {isClassNotes && Array.isArray(notesData.detailed_notes) && notesData.detailed_notes.length > 0 && (
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ListChecks size={16} color="#0F766E" /> Detailed Topic Notes
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {notesData.detailed_notes.map((item: any, idx: number) => (
                  <div key={idx} style={{ background: 'var(--color-surface)', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #0F766E' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                      {typeof item === 'string' ? item : item.topic_title || item.topic_name || `Topic ${idx + 1}`}
                    </div>
                    {item.explanation && (
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                        {item.explanation}
                      </div>
                    )}
                    {Array.isArray(item.key_points) && item.key_points.length > 0 && (
                      <ul style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                        {item.key_points.map((kp: string, kidx: number) => (
                          <li key={kidx}>{kp}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Points Discussed (MOM Mode) */}
          {!isClassNotes && Array.isArray(notesData.points_discussed) && notesData.points_discussed.length > 0 && (
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: 'var(--color-text-primary)' }}>
                Points Discussed
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {notesData.points_discussed.map((cat: any, idx: number) => (
                  <div key={idx} style={{ background: 'var(--color-surface)', padding: '10px 12px', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F766E', marginBottom: '4px' }}>
                      {cat.category_name || 'Category'}
                    </div>
                    {Array.isArray(cat.points) && (
                      <ul style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {cat.points.map((pt: string, pidx: number) => (
                          <li key={pidx}>{pt}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Important Concepts & Definitions (Class Notes Mode) */}
          {isClassNotes && Array.isArray(notesData.important_concepts) && notesData.important_concepts.length > 0 && (
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lightbulb size={16} color="#F59E0B" /> Important Concepts & Definitions
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {notesData.important_concepts.map((concept: any, idx: number) => (
                  <div key={idx} style={{ fontSize: '13px', background: 'rgba(245, 158, 11, 0.08)', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid #F59E0B' }}>
                    {typeof concept === 'string' ? (
                      <span style={{ color: 'var(--color-text-secondary)' }}>{concept}</span>
                    ) : (
                      <>
                        <strong style={{ color: '#F59E0B' }}>{concept.term_or_concept || concept.term}: </strong>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{concept.definition_or_explanation || concept.explanation}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Code & Technical Examples */}
          {isClassNotes && Array.isArray(notesData.code_technical_examples) && notesData.code_technical_examples.length > 0 && (
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code size={16} color="#14B8A6" /> Code / Technical Examples
              </h4>
              {notesData.code_technical_examples.map((item: any, idx: number) => (
                <div key={idx} style={{ background: '#1F2937', padding: '10px 12px', borderRadius: '6px', marginBottom: '8px', color: '#F3F4F6' }}>
                  {item.language_or_context && (
                    <div style={{ fontSize: '11px', color: '#2DD4BF', fontWeight: 700, marginBottom: '4px' }}>
                      {item.language_or_context}
                    </div>
                  )}
                  {item.code_snippet && (
                    <pre style={{ fontFamily: 'Consolas, monospace', fontSize: '12px', color: '#F3F4F6', background: 'rgba(0, 0, 0, 0.3)', padding: '8px', borderRadius: '4px', overflowX: 'auto' }}>
                      {item.code_snippet}
                    </pre>
                  )}
                  {item.explanation && (
                    <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
                      {item.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Questions & Answers */}
          {isClassNotes && Array.isArray(notesData.questions_and_answers) && notesData.questions_and_answers.length > 0 && (
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HelpCircle size={16} color="#3B82F6" /> Questions & Answers
              </h4>
              {notesData.questions_and_answers.map((item: any, idx: number) => (
                <div key={idx} style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '8px 12px', borderRadius: '6px', marginBottom: '6px' }}>
                  {typeof item === 'string' ? (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{item}</div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 700, fontSize: '12px', color: '#3B82F6' }}>Q: {item.question}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>A: {item.answer}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Action Items / Tasks / Key Takeaways */}
          {note.actionItems && note.actionItems.length > 0 && (
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckSquare size={16} color="#14B8A6" />
                {isClassNotes ? 'Key Takeaways & Practical Tips' : 'Action Items & Tasks'}
              </h4>
              <ul style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {note.actionItems.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--color-gray-200)' }}>
          <div>
            {onDeleteNote && (
              <button
                className="user-btn"
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontWeight: 600,
                }}
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={15} />
                <span>Delete Note</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {docxUrl ? (
              <a
                href={docxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="user-btn"
                onClick={handleDownloadDocx}
                style={{
                  background: 'var(--gradient-primary)',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  border: 'none',
                }}
              >
                <Download size={15} />
                <span>Download DOCX</span>
              </a>
            ) : (
              <button
                className="user-btn"
                style={{ background: 'var(--gradient-primary)', color: '#FFFFFF', padding: '8px 16px', borderRadius: '6px', border: 'none' }}
                onClick={() => alert('DOCX is not available for this note.')}
              >
                <Download size={15} />
                <span>Download DOCX</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Delete from Detail View */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !isDeleting && setShowDeleteConfirm(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444' }}>
                <Trash2 size={20} />
                <span className="modal-title" style={{ color: 'var(--color-text-primary)' }}>Delete Note?</span>
              </div>
              <button className="btn-close" onClick={() => !isDeleting && setShowDeleteConfirm(false)} disabled={isDeleting}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
              Are you sure you want to permanently delete{' '}
              <strong style={{ color: 'var(--color-text-primary)' }}>"{note.title}"</strong>?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                className="btn-stop"
                style={{ padding: '8px 16px', fontSize: '13px' }}
                onClick={() => setShowDeleteConfirm(false)}
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
                onClick={async () => {
                  if (!onDeleteNote) return;
                  try {
                    setIsDeleting(true);
                    const success = await onDeleteNote(note.id);
                    if (success) {
                      onClose();
                    }
                  } catch (err) {
                    console.error('Failed to delete note from modal:', err);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
