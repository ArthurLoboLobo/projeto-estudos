export interface User {
  id: string;
  email: string;
}

// Session status enum (matches backend)
export type SessionStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED';

// Draft plan topic (before confirmation)
export interface DraftPlanTopic {
  id: string;
  title: string;
  description: string | null;
  isCompleted: boolean;
}

// Draft plan (stored in session.draftPlan)
export interface DraftPlan {
  topics: DraftPlanTopic[];
}

export interface Session {
  id: string;
  title: string;
  description: string | null;
  status: SessionStatus;
  draftPlan: DraftPlan | null;
  createdAt: string;
  updatedAt: string;
}

// Processing status for documents
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Document {
  id: string;
  sessionId: string;
  fileName: string;
  filePath: string;
  contentLength: number | null;
  processingStatus: ProcessingStatus;
  createdAt: string;
}

// Topic (materialized after startStudying)
export interface Topic {
  id: string;
  sessionId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// Chat types
export type ChatType = 'TOPIC_SPECIFIC' | 'GENERAL_REVIEW';

export interface Chat {
  id: string;
  sessionId: string;
  chatType: ChatType;
  topicId: string | null;
  isStarted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}
