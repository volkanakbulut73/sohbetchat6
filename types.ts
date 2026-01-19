export enum UserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  USER = 'user',
  BOT = 'bot'
}

export interface User {
  id: string;
  username: string;
  avatar?: string;
  role: UserRole;
  isOnline: boolean;
  banned?: boolean;
}

export interface Room {
  id: string;
  name: string;
  topic?: string;
  isMuted?: boolean;
}

export interface Message {
  id: string;
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
  text: string;
  user: string; // User ID
  room: string; // Room ID
  expand?: {
    user?: User;
  };
  attachment?: string; // URL to file
  type?: 'text' | 'image' | 'audio' | 'action'; // action = /me
}

export interface PrivateMessage {
  id: string;
  text: string;
  sender: string; // User ID
  recipient: string; // User ID
  created: string;
  attachment?: string;
  type?: 'text' | 'image' | 'audio';
  expand?: {
    sender?: User;
    recipient?: User;
  }
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string; // YouTube or MP3 link
  addedBy: string;
}

export interface ChatSession {
  currentUser: User | null;
  currentRoom: Room | null;
}