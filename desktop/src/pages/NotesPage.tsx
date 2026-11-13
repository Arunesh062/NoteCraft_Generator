import React from 'react';
import { NoteList } from '../components/NoteList';
import { NoteItem } from '../types/note';

interface NotesPageProps {
  notes: NoteItem[];
  onSelectNote: (note: NoteItem) => void;
  onDeleteNote?: (noteId: string) => Promise<boolean>;
  onDeleteAllNotes?: () => Promise<boolean>;
  onNavigateToDashboard?: () => void;
}

export const NotesPage: React.FC<NotesPageProps> = ({
  notes,
  onSelectNote,
  onDeleteNote,
  onDeleteAllNotes,
  onNavigateToDashboard,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <NoteList
        notes={notes}
        onSelectNote={onSelectNote}
        onDeleteNote={onDeleteNote}
        onDeleteAllNotes={onDeleteAllNotes}
        onNavigateToDashboard={onNavigateToDashboard}
      />
    </div>
  );
};
