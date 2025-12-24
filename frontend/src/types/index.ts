export interface User {
  id: string;
  email: string;
}

export interface Session {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  fileName: string;
  filePath: string;
  contentLength: number;
  extractionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  pageCount: number | null;
  createdAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}
