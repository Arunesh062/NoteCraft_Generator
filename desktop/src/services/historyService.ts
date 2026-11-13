import { NoteItem } from '../types/note';
import { MeetingMode } from '../types/recording';
import { API_BASE_URL } from './apiService';
import { saveDesktopNoteToFirestore } from './firestoreService';

const INITIAL_NOTES: NoteItem[] = [
  {
    id: 'note_1',
    title: 'Product Architecture Review & Desktop Roadmap',
    meetingMode: 'mom',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    duration: '35 mins',
    summary:
      'Discussed NoteCraft Phase 1 Electron desktop architecture, Firebase integration boundaries, and upcoming Phase 2 audio capture module. Backend will remain unchanged on Render.',
    actionItems: [
      'Finalize Electron IPC preload security contract',
      'Integrate Firebase Authentication environment configuration',
      'Prepare desktop application UI components for Phase 2 audio integration',
    ],
    keyTopics: ['Electron Security', 'Firebase Auth', 'FastAPI Backend', 'Phase 2 Audio Pipeline'],
    tags: ['Architecture', 'Electron', 'MOM'],
  },
  {
    id: 'note_2',
    title: 'Distributed Systems & Microservices Lecture 8',
    meetingMode: 'class_notes',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    duration: '50 mins',
    summary:
      'Comprehensive lecture covering event-driven microservices, asynchronous processing pipelines, message queues, and client-side stream buffering strategies.',
    actionItems: [
      'Review RPC vs REST vs WebSocket latency profiles',
      'Complete lab exercise on IPC event bridge pattern',
    ],
    keyTopics: ['Event-Driven Architecture', 'IPC Event Bridge', 'Stream Buffering', 'Microservices'],
    tags: ['Lecture', 'Class Notes', 'Systems'],
  },
];

const GUEST_STORAGE_KEY = 'notecraft_desktop_notes_guest';

export const getStorageKeyForUser = (userUid?: string | null): string => {
  if (userUid) {
    return `notecraft_desktop_notes_${userUid}`;
  }
  return GUEST_STORAGE_KEY;
};

export const getStoredNotes = (userUid?: string | null): NoteItem[] => {
  try {
    const key = getStorageKeyForUser(userUid);
    const data = localStorage.getItem(key);
    if (!data) {
      if (!userUid) {
        // Guest mode gets initial sample notes if empty
        localStorage.setItem(key, JSON.stringify(INITIAL_NOTES));
        return INITIAL_NOTES;
      }
      return [];
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return !userUid ? INITIAL_NOTES : [];
  } catch (err) {
    console.warn('[historyService] Failed to read/parse localStorage notes:', err);
    return !userUid ? INITIAL_NOTES : [];
  }
};

export const saveStoredNotes = (notes: NoteItem[], userUid?: string | null): void => {
  try {
    const key = getStorageKeyForUser(userUid);
    localStorage.setItem(key, JSON.stringify(notes));
  } catch (err) {
    console.error('[historyService] Failed to save notes to localStorage (Quota or Storage disabled):', err);
  }
};

export const deleteStoredNote = (noteId: string, userUid?: string | null): NoteItem[] => {
  const current = getStoredNotes(userUid);
  const updated = current.filter((n) => n.id !== noteId);
  saveStoredNotes(updated, userUid);
  return updated;
};

export const clearStoredNotes = (userUid?: string | null): void => {
  saveStoredNotes([], userUid);
};

export const addNote = (note: Omit<NoteItem, 'id' | 'createdAt'>, userUid?: string | null): NoteItem => {
  const current = getStoredNotes(userUid);
  const newNote: NoteItem = {
    ...note,
    id: `note_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [newNote, ...current];
  saveStoredNotes(updated, userUid);
  return newNote;
};

export const mergeCloudAndLocalNotes = (cloudNotes: NoteItem[], localNotes: NoteItem[]): NoteItem[] => {
  const map = new Map<string, NoteItem>();
  localNotes.forEach((n) => {
    if (n.id) map.set(n.id, n);
  });
  cloudNotes.forEach((n) => {
    if (n.id) map.set(n.id, n);
  });
  const merged = Array.from(map.values());
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged;
};

export const createRealRecordingNote = (
  meetingMode: MeetingMode,
  durationFormatted: string,
  backendResult?: {
    docx_url?: string | null;
    pdf_url?: string | null;
    notes_data?: any | null;
  },
  userUid?: string | null
): NoteItem => {
  const isMom = meetingMode === 'mom';
  const notesData = backendResult?.notes_data || {};

  const title =
    notesData?.session_title ||
    notesData?.title ||
    (isMom ? 'Minutes of the Meeting (Generated)' : 'Class / Webinar Notes (Generated)');

  let summary = 'Generated summary from live recording.';
  const keyTopics: string[] = [];
  const actionItems: string[] = [];

  if (isMom) {
    if (Array.isArray(notesData?.points_discussed) && notesData.points_discussed.length > 0) {
      const topicSummaries: string[] = [];
      notesData.points_discussed.forEach((cat: any) => {
        if (cat.category_name) keyTopics.push(cat.category_name);
        if (Array.isArray(cat.points)) {
          topicSummaries.push(...cat.points);
        }
      });
      if (topicSummaries.length > 0) {
        summary = topicSummaries.slice(0, 4).join(' ');
      }
    } else if (notesData?.final_summary || notesData?.session_summary) {
      summary = notesData.final_summary || notesData.session_summary;
    }

    if (Array.isArray(notesData?.responsibility_matrix)) {
      notesData.responsibility_matrix.forEach((item: any) => {
        if (item.category_name || item.responsibility) {
          actionItems.push(`${item.category_name || 'Action'}: Assigned to ${item.responsibility || 'All'}`);
        }
      });
    }
  } else {
    // Class / Webinar Notes mode
    if (notesData?.overview || notesData?.final_summary || notesData?.session_summary) {
      summary = notesData.overview || notesData.final_summary || notesData.session_summary;
    }

    if (Array.isArray(notesData?.topics_covered)) {
      notesData.topics_covered.forEach((topic: string) => {
        if (topic) keyTopics.push(topic);
      });
    } else if (Array.isArray(notesData?.detailed_notes)) {
      notesData.detailed_notes.forEach((dn: any) => {
        if (dn?.topic_title || dn?.topic_name) {
          keyTopics.push(dn.topic_title || dn.topic_name);
        }
      });
    }

    if (Array.isArray(notesData?.key_takeaways)) {
      notesData.key_takeaways.forEach((kt: string) => {
        if (kt) actionItems.push(kt);
      });
    }
    if (Array.isArray(notesData?.practical_tips)) {
      notesData.practical_tips.forEach((pt: string) => {
        if (pt) actionItems.push(`Tip: ${pt}`);
      });
    }
  }

  let docxUrl: string | undefined;
  if (backendResult?.docx_url) {
    docxUrl = backendResult.docx_url.startsWith('http')
      ? backendResult.docx_url
      : `${API_BASE_URL}${backendResult.docx_url}`;
  }

  let pdfUrl: string | undefined;
  if (backendResult?.pdf_url) {
    pdfUrl = backendResult.pdf_url.startsWith('http')
      ? backendResult.pdf_url
      : `${API_BASE_URL}${backendResult.pdf_url}`;
  }

  const newNote = addNote(
    {
      title,
      meetingMode,
      duration: durationFormatted || 'Real Capture',
      summary,
      actionItems: actionItems.length > 0 ? actionItems : [isMom ? 'Review meeting minutes' : 'Review class notes'],
      keyTopics: keyTopics.length > 0 ? keyTopics : [isMom ? 'MOM Summary' : 'Class Notes', 'Groq STT', 'FastAPI'],
      tags: isMom ? ['MOM', 'Generated', 'Desktop'] : ['Class Notes', 'Generated', 'Desktop'],
      docxUrl,
      pdfUrl,
      notesData,
    },
    userUid
  );

  if (userUid) {
    saveDesktopNoteToFirestore(userUid, newNote).catch((err) => {
      console.warn('Async Firestore sync warning:', err);
    });
  }

  return newNote;
};

export const createMockRecordingNote = (meetingMode: MeetingMode, userUid?: string | null): NoteItem => {
  const isMom = meetingMode === 'mom';
  return addNote(
    {
      title: isMom ? 'Executive Sync & Action Items' : 'Webinar / Lecture Summary',
      meetingMode,
      duration: '02:15',
      summary: isMom
        ? 'NoteCraft Desktop meeting note.'
        : 'NoteCraft Desktop webinar note.',
      actionItems: isMom
        ? ['Verify desktop UI flow', 'Verify React component state transitions']
        : ['Study lecture concepts', 'Verify React component state transitions'],
      keyTopics: isMom ? ['UI Foundation', 'IPC Interface'] : ['Class Notes Template', 'UI State'],
      tags: isMom ? ['MOM'] : ['Class Notes'],
    },
    userUid
  );
};

