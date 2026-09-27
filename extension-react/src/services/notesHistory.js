import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Saves a generated note to Firestore under the authenticated user's document scope:
 * path: users/{uid}/notes/{noteId}
 *
 * Uses setDoc with noteId (sessionId) to ensure idempotency.
 */
export async function saveNoteToHistory(uid, noteId, mode, generatedNotes) {
  if (!uid || !noteId) {
    throw new Error('User ID and Note ID are required to save note.');
  }

  const isClass = mode === 'class_notes';
  const fallbackTitle = isClass ? 'Class / Webinar Notes' : 'Meeting Minutes';
  const title = generatedNotes?.session_title || generatedNotes?.title || fallbackTitle;
  const sourceType = isClass ? 'class_webinar' : 'meeting';

  const noteRef = doc(db, 'users', uid, 'notes', noteId);
  const noteData = {
    id: noteId,
    sessionId: noteId,
    title,
    mode: isClass ? 'class_notes' : 'mom',
    sourceType,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    generatedNotes: generatedNotes || {}
  };

  await setDoc(noteRef, noteData, { merge: true });
  return noteData;
}

/**
 * Retrieves all notes for the authenticated user ordered by creation time (descending).
 * path: users/{uid}/notes
 */
export async function getUserNotesHistory(uid) {
  if (!uid) return [];

  const notesCollectionRef = collection(db, 'users', uid, 'notes');

  try {
    const q = query(notesCollectionRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (err) {
    console.warn('Ordered query failed (index missing or timestamp resolving), falling back to unordered fetch:', err);
    const snapshot = await getDocs(notesCollectionRef);
    const docs = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    // Client-side fallback sort by createdAt timestamp or date string
    docs.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
      const timeB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
      return timeB - timeA;
    });

    return docs;
  }
}

/**
 * Deletes a note document for the authenticated user.
 * path: users/{uid}/notes/{noteId}
 */
export async function deleteNoteFromHistory(uid, noteId) {
  if (!uid || !noteId) return;
  const noteRef = doc(db, 'users', uid, 'notes', noteId);
  await deleteDoc(noteRef);
}
