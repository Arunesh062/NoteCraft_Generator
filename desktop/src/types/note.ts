import { MeetingMode } from './recording';

export interface NoteItem {
  id: string;
  title: string;
  meetingMode: MeetingMode;
  createdAt: string;
  duration: string;
  summary: string;
  actionItems?: string[];
  keyTopics?: string[];
  tags: string[];
  docxUrl?: string;
  pdfUrl?: string;
  notesData?: any;
}
