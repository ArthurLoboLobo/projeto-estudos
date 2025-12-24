export interface User {
  id: string;
  email: string;
}

export interface Session {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  fileName: string;
  filePath: string;
  contentLength: number;
  createdAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

