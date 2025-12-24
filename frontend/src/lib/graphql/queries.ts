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
      fileName
      filePath
      contentLength
      extractionStatus
      pageCount
      createdAt
    }
  }
`;

// ============ MESSAGES ============

export const GET_MESSAGES = gql`
  query GetMessages($sessionId: ID!) {
    messages(sessionId: $sessionId) {
      id
      role
      content
      createdAt
    }
  }
`;

// ============ DOCUMENT URL ============

export const GET_DOCUMENT_URL = gql`
  query GetDocumentUrl($id: ID!) {
    documentUrl(id: $id)
  }
`;
