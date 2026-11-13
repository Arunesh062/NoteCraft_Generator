import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { NoteItem } from '../types/note';

/**
 * Saves a desktop note to Firestore under users/{uid}/notes/{noteId}.
 * Idempotent write using setDoc with merge: true.
 */
export const saveDesktopNoteToFirestore = async (uid: string, note: NoteItem): Promise<void> => {
  if (!db || !uid || !note.id) return;

  const isClass = note.meetingMode === 'class_notes';

  const noteRef = doc(db, 'users', uid, 'notes', note.id);
  const firestoreData = {
    id: note.id,
    sessionId: note.id,
    title: note.title,
    mode: isClass ? 'class_notes' : 'mom',
    sourceType: isClass ? 'class_webinar' : 'meeting',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    generatedNotes: note.notesData || {},
    // Desktop-specific fields
    meetingMode: note.meetingMode,
    duration: note.duration || 'Real Capture',
    summary: note.summary || '',
    actionItems: note.actionItems || [],
    keyTopics: note.keyTopics || [],
    tags: note.tags || [],
    docxUrl: note.docxUrl || null,
    pdfUrl: note.pdfUrl || null,
    notesData: note.notesData || null,
  };

  await setDoc(noteRef, firestoreData, { merge: true });
};

/**
 * Retrieves all notes for the authenticated user from Firestore path users/{uid}/notes.
 * Safely parses Firestore Timestamps into NoteItem.createdAt ISO strings.
 */
export const getDesktopNotesFromFirestore = async (uid: string): Promise<NoteItem[]> => {
  if (!db || !uid) return [];

  const notesCollectionRef = collection(db, 'users', uid, 'notes');

  try {
    const q = query(notesCollectionRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => parseFirestoreDocToNoteItem(docSnap.id, docSnap.data()));
  } catch (err) {
    console.warn('Ordered query failed (fallback to unordered fetch):', err);
    const snapshot = await getDocs(notesCollectionRef);
    const notes = snapshot.docs.map((docSnap) => parseFirestoreDocToNoteItem(docSnap.id, docSnap.data()));

    notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return notes;
  }
};

/**
 * Deletes a note document from Firestore users/{uid}/notes/{noteId}.
 */
export const deleteDesktopNoteFromFirestore = async (uid: string, noteId: string): Promise<void> => {
  if (!db || !uid || !noteId) return;
  const noteRef = doc(db, 'users', uid, 'notes', noteId);
  await deleteDoc(noteRef);
};

/**
 * Deletes all notes for the authenticated user from Firestore path users/{uid}/notes.
 * Strictly operates on the current user's UID scope.
 */
export const deleteAllDesktopNotesFromFirestore = async (uid: string): Promise<void> => {
  if (!db || !uid) return;
  const notesCollectionRef = collection(db, 'users', uid, 'notes');
  const snapshot = await getDocs(notesCollectionRef);
  const deletePromises = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
  await Promise.all(deletePromises);
};

/**
 * Syncs an array of local notes to Firestore for an authenticated user.
 */
export const syncLocalNotesToFirestore = async (uid: string, localNotes: NoteItem[]): Promise<number> => {
  if (!db || !uid || localNotes.length === 0) return 0;

  let count = 0;
  for (const note of localNotes) {
    try {
      await saveDesktopNoteToFirestore(uid, note);
      count++;
    } catch (err) {
      console.warn(`Failed to sync note ${note.id} to Firestore:`, err);
    }
  }
  return count;
};

/**
 * Helper: Safely converts a Firestore document to NoteItem
 */
const parseFirestoreDocToNoteItem = (docId: string, data: any): NoteItem => {
  let createdAtStr = new Date().toISOString();
  if (data.createdAt) {
    if (typeof data.createdAt.toMillis === 'function') {
      createdAtStr = new Date(data.createdAt.toMillis()).toISOString();
    } else if (typeof data.createdAt.seconds === 'number') {
      createdAtStr = new Date(data.createdAt.seconds * 1000).toISOString();
    } else if (typeof data.createdAt === 'string') {
      createdAtStr = data.createdAt;
    }
  }

  const generated = data.generatedNotes || data.notesData || {};
  const isClass = data.mode === 'class_notes' || data.meetingMode === 'class_notes';

  return {
    id: data.id || docId,
    title: data.title || generated.session_title || generated.title || (isClass ? 'Class Notes' : 'Meeting Minutes'),
    meetingMode: isClass ? 'class_notes' : 'mom',
    createdAt: createdAtStr,
    duration: data.duration || 'Real Capture',
    summary: data.summary || generated.overview || generated.final_summary || 'No summary available.',
    actionItems: data.actionItems || [],
    keyTopics: data.keyTopics || [],
    tags: data.tags || (isClass ? ['Class Notes', 'Cloud'] : ['MOM', 'Cloud']),
    docxUrl: data.docxUrl || (generated.docx_url ? (generated.docx_url.startsWith('http') ? generated.docx_url : `https://notecraft-backend-4ktk.onrender.com${generated.docx_url}`) : undefined),
    pdfUrl: data.pdfUrl || undefined,
    notesData: generated,
  };
};
