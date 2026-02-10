
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  EMOJI = 'emoji',
  AUDIO = 'audio'
}

export interface Message {
  id: string;
  senderId: 'me' | 'partner';
  content: string;
  type: MessageType;
  timestamp: number;
  isRead: boolean;
  selfDestruct?: boolean;
  destructAt?: number;
}

export interface Anniversary {
  id: string;
  title: string;
  date: string;
  reminderDays: number; // 0, 1, 3 etc.
}

export interface Moment {
  id: string;
  author: string;
  content: string;
  media: string[];
  type: 'image' | 'video';
  timestamp: number;
  likes: string[];
  comments: Comment[];
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: number;
}

export interface PhotoAlbum {
  id: string;
  name: string;
  photos: string[];
}

