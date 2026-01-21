import { gql } from '@apollo/client/core';

// ============ AUTH ============

export const ME = gql`
  query Me {
    me {
      id
      email
    }
  }
`;

// ============ SESSIONS ============

export const GET_SESSIONS = gql`
  query GetSessions {
    sessions {
      id
      title
      description
      status
      draftPlan {
        topics {
          id
          title
          description
          isCompleted
        }
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_SESSION = gql`
  query GetSession($id: ID!) {
    session(id: $id) {
      id
      title
      description
      status
      draftPlan {
        topics {
          id
          title
          description
          isCompleted
        }
      }
      createdAt
      updatedAt
    }
  }
`;

// ============ DOCUMENTS ============

export const GET_DOCUMENTS = gql`
  query GetDocuments($sessionId: ID!) {
    documents(sessionId: $sessionId) {
      id
      sessionId
      fileName
      filePath
      contentLength
      processingStatus
      createdAt
    }
  }
`;

export const GET_DOCUMENT_URL = gql`
  query GetDocumentUrl($id: ID!) {
    documentUrl(id: $id)
  }
`;

// ============ TOPICS ============

export const GET_TOPICS = gql`
  query GetTopics($sessionId: ID!) {
    topics(sessionId: $sessionId) {
      id
      sessionId
      title
      description
      orderIndex
      isCompleted
      createdAt
      updatedAt
    }
  }
`;

export const GET_TOPIC = gql`
  query GetTopic($id: ID!) {
    topic(id: $id) {
      id
      sessionId
      title
      description
      orderIndex
      isCompleted
      createdAt
      updatedAt
    }
  }
`;

// ============ CHATS ============

export const GET_CHATS = gql`
  query GetChats($sessionId: ID!) {
    chats(sessionId: $sessionId) {
      id
      sessionId
      chatType
      topicId
      isStarted
      createdAt
      updatedAt
    }
  }
`;

export const GET_CHAT = gql`
  query GetChat($id: ID!) {
    chat(id: $id) {
      id
      sessionId
      chatType
      topicId
      isStarted
      createdAt
      updatedAt
    }
  }
`;

export const GET_CHAT_BY_TOPIC = gql`
  query GetChatByTopic($topicId: ID!) {
    chatByTopic(topicId: $topicId) {
      id
      sessionId
      chatType
      topicId
      isStarted
      createdAt
      updatedAt
    }
  }
`;

export const GET_REVIEW_CHAT = gql`
  query GetReviewChat($sessionId: ID!) {
    reviewChat(sessionId: $sessionId) {
      id
      sessionId
      chatType
      topicId
      isStarted
      createdAt
      updatedAt
    }
  }
`;

// ============ MESSAGES ============

export const GET_MESSAGES = gql`
  query GetMessages($chatId: ID!) {
    messages(chatId: $chatId) {
      id
      chatId
      role
      content
      createdAt
    }
  }
`;
