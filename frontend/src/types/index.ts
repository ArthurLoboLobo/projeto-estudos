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

export type TopicStatus = 'need_to_learn' | 'need_review' | 'know_well';

export interface StudyPlanTopic {
  id: string;
  title: string;
  description: string;
  status: TopicStatus;
}

export interface StudyPlanContent {
  topics: StudyPlanTopic[];
}

export interface StudyPlan {
  id: string;
  sessionId: string;
  version: number;
  contentMd: string;
  content: StudyPlanContent;
  instruction: string | null;
  createdAt: string;
}
