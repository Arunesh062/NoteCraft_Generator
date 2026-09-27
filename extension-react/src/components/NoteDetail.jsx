import React, { useState } from 'react';
import { ArrowLeft, Download, Loader2, Calendar, User, FileText, BookOpen } from 'lucide-react';
import { BACKEND_URL } from '../../config';

const NoteDetail = ({ note, onBack }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadErr, setDownloadErr] = useState('');

  if (!note) return null;

  const data = note.generatedNotes || {};
  const isClass = note.mode === 'class_notes' || data.document_type === 'class_notes';

  const handleDownloadDocx = async () => {
    setDownloading(true);
    setDownloadErr('');
    try {
      const response = await fetch(`${BACKEND_URL}/export-docx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: note.id || note.sessionId,
          generated_notes: data
        })
      });

      if (!response.ok) {
        throw new Error(`Export failed with HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const cleanTitle = (note.title || 'NoteCraft_Doc').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      link.download = `${cleanTitle}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download DOCX error:', err);
      setDownloadErr('Could not generate DOCX download. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const formatDate = () => {
    if (data.date) return data.date;
    if (note.createdAt?.seconds) {
      return new Date(note.createdAt.seconds * 1000).toLocaleDateString();
    }
    return new Date().toLocaleDateString();
  };

  return (
    <div className="nc-note-detail">
      {/* Top Bar */}
      <div className="nc-detail-topbar">
        <button type="button" onClick={onBack} className="nc-btn-icon" title="Back to History">
          <ArrowLeft size={16} /> <span>Back</span>
        </button>
        <button 
          type="button" 
          onClick={handleDownloadDocx} 
          disabled={downloading}
          className="nc-btn nc-btn-success nc-detail-download-btn"
        >
          {downloading ? <Loader2 size={14} className="nc-spin" /> : <Download size={14} />}
          <span>{downloading ? 'Downloading…' : 'Download DOCX'}</span>
        </button>
      </div>

      {downloadErr && (
        <div className="nc-auth-error-banner" style={{ margin: '8px 0' }}>
          <span>{downloadErr}</span>
        </div>
      )}

      {/* Header */}
      <div className="nc-detail-header">
        <div className="nc-detail-badge-row">
          <span className={`nc-history-badge ${isClass ? 'class' : 'mom'}`}>
            {isClass ? '📚 CLASS / WEBINAR' : '📋 MOM'}
          </span>
          <span className="nc-detail-date">
            <Calendar size={12} /> {formatDate()}
          </span>
        </div>
        <h3 className="nc-detail-title">{note.title || (isClass ? 'Class / Webinar Notes' : 'Meeting Minutes')}</h3>
      </div>

      {/* Content Viewer Body */}
      <div className="nc-detail-body">
        {!isClass ? (
          /* ── MOM DETAILS VIEW ── */
          <div className="nc-mom-view">
            {/* Metadata Box */}
            <div className="nc-view-box">
              <h4 className="nc-view-section-title">Meeting Info</h4>
              <div className="nc-view-grid">
                <div><strong>Venue/Platform:</strong> {data.venue_platform || 'Google Meet'}</div>
                <div><strong>Time:</strong> {data.time || 'Scheduled Session'}</div>
                <div><strong>Members Present:</strong> {Array.isArray(data.members_present) ? data.members_present.join(', ') : (data.members_present || 'Attendees')}</div>
              </div>
            </div>

            {/* Points Discussed */}
            {Array.isArray(data.points_discussed) && data.points_discussed.length > 0 && (
              <div className="nc-view-box">
                <h4 className="nc-view-section-title">Points Discussed</h4>
                {data.points_discussed.map((cat, i) => (
                  <div key={i} className="nc-view-cat">
                    <h5 className="nc-cat-title">{cat.category_name || 'Discussion'}</h5>
                    <ul className="nc-bullet-list">
                      {Array.isArray(cat.points) ? cat.points.map((pt, j) => (
                        <li key={j}>{pt}</li>
                      )) : <li>{cat.points}</li>}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Responsibility Matrix */}
            {Array.isArray(data.responsibility_matrix) && data.responsibility_matrix.length > 0 && (
              <div className="nc-view-box">
                <h4 className="nc-view-section-title">Responsibility Matrix</h4>
                <div className="nc-table-wrapper">
                  <table className="nc-view-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Responsibility</th>
                        <th>Target Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.responsibility_matrix.map((row, i) => (
                        <tr key={i}>
                          <td>{row.category_name || 'General'}</td>
                          <td>{row.responsibility || 'All'}</td>
                          <td>{row.target_date || 'Continuous'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Information Items */}
            {Array.isArray(data.information_items) && data.information_items.length > 0 && (
              <div className="nc-view-box">
                <h4 className="nc-view-section-title">Information Items</h4>
                <ul className="nc-bullet-list">
                  {data.information_items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          /* ── CLASS / WEBINAR NOTES VIEW ── */
          <div className="nc-class-view">
            {/* Metadata Box */}
            <div className="nc-view-box">
              <h4 className="nc-view-section-title">Session Overview</h4>
              <div className="nc-view-grid">
                <div><strong>Speaker/Instructor:</strong> {data.speaker_instructor || 'Speaker'}</div>
                <div><strong>Session Type:</strong> {data.session_type || 'Class / Webinar'}</div>
              </div>
              {data.overview && (
                <p className="nc-overview-text">{data.overview}</p>
              )}
            </div>

            {/* Topics Covered */}
            {Array.isArray(data.topics_covered) && data.topics_covered.length > 0 && (
              <div className="nc-view-box">
                <h4 className="nc-view-section-title">Topics Covered</h4>
                <ul className="nc-bullet-list">
                  {data.topics_covered.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Detailed Notes */}
            {Array.isArray(data.detailed_notes) && data.detailed_notes.length > 0 && (
              <div className="nc-view-box">
                <h4 className="nc-view-section-title">Detailed Notes</h4>
                {data.detailed_notes.map((item, i) => (
                  <div key={i} className="nc-view-topic">
                    <h5 className="nc-topic-title">{item.topic_title || item.topic_name || `Topic ${i + 1}`}</h5>
                    {item.explanation && <p className="nc-topic-exp">{item.explanation}</p>}
                    {Array.isArray(item.key_points) && item.key_points.length > 0 && (
                      <ul className="nc-bullet-list">
                        {item.key_points.map((kp, j) => <li key={j}>{kp}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Important Concepts */}
            {Array.isArray(data.important_concepts) && data.important_concepts.length > 0 && (
              <div className="nc-view-box">
                <h4 className="nc-view-section-title">Important Concepts</h4>
                <div className="nc-concepts-list">
                  {data.important_concepts.map((c, i) => (
                    <div key={i} className="nc-concept-item">
                      <strong className="nc-concept-term">{c.term_or_concept || c.term}:</strong>
                      <span> {c.definition_or_explanation || c.explanation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Code / Technical Examples */}
            {Array.isArray(data.code_technical_examples) && data.code_technical_examples.length > 0 && (
              <div className="nc-view-box">
                <h4 className="nc-view-section-title">Code & Technical Examples</h4>
                {data.code_technical_examples.map((item, i) => (
                  <div key={i} className="nc-code-block-wrapper">
                    <div className="nc-code-lang">{item.language_or_context || 'Code'}</div>
                    {item.code_snippet && (
                      <pre className="nc-code-snippet"><code>{item.code_snippet}</code></pre>
                    )}
                    {item.explanation && <p className="nc-code-exp">{item.explanation}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Final Summary & Takeaways */}
            {data.final_summary && (
              <div className="nc-view-box">
                <h4 className="nc-view-section-title">Final Summary</h4>
                <p className="nc-overview-text">{data.final_summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NoteDetail;
