export interface User {
  id: string;
  email: string;
}

export type SessionStage = 'UPLOADING' | 'PLANNING' | 'STUDYING';

export interface Session {
  id: string;
  title: string;
  description: string | null;
  stage: SessionStage;
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

export interface StudyPlan {
  id: string;
  sessionId: string;
  version: number;
  contentMd: string;
  instruction: string | null;
  createdAt: string;
}
