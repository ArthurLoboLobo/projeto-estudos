import { gql } from '@apollo/client/core';

// ============ AUTH ============

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        email
      }
    }
  }
`;

export const REGISTER = gql`
  mutation Register($email: String!, $password: String!) {
    register(email: $email, password: $password) {
      token
      user {
        id
        email
      }
    }
  }
`;

// ============ SESSIONS ============

export const CREATE_SESSION = gql`
  mutation CreateSession($title: String!, $description: String) {
    createSession(title: $title, description: $description) {
      id
      title
      description
      stage
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_SESSION = gql`
  mutation UpdateSession($id: ID!, $title: String, $description: String) {
    updateSession(id: $id, title: $title, description: $description) {
      id
      title
      description
      stage
      updatedAt
    }
  }
`;

export const DELETE_SESSION = gql`
  mutation DeleteSession($id: ID!) {
    deleteSession(id: $id)
  }
`;

// ============ DOCUMENTS ============
// Note: Document upload now uses /api/upload endpoint (not GraphQL)

export const DELETE_DOCUMENT = gql`
  mutation DeleteDocument($id: ID!) {
    deleteDocument(id: $id)
  }
`;

// ============ MESSAGES ============

export const SEND_MESSAGE = gql`
  mutation SendMessage($sessionId: ID!, $content: String!) {
    sendMessage(sessionId: $sessionId, content: $content) {
      id
      role
      content
      createdAt
    }
  }
`;

export const CLEAR_MESSAGES = gql`
  mutation ClearMessages($sessionId: ID!) {
    clearMessages(sessionId: $sessionId)
  }
`;

// ============ PLANNING ============

export const START_PLANNING = gql`
  mutation StartPlanning($sessionId: ID!) {
    startPlanning(sessionId: $sessionId) {
      id
      sessionId
      version
      contentMd
      content {
        topics {
          id
          title
          description
          status
        }
      }
      instruction
      createdAt
    }
  }
`;

export const REVISE_STUDY_PLAN = gql`
  mutation ReviseStudyPlan($sessionId: ID!, $instruction: String!) {
    reviseStudyPlan(sessionId: $sessionId, instruction: $instruction) {
      id
      sessionId
      version
      contentMd
      content {
        topics {
          id
          title
          description
          status
        }
      }
      instruction
      createdAt
    }
  }
`;

export const UNDO_STUDY_PLAN = gql`
  mutation UndoStudyPlan($sessionId: ID!) {
    undoStudyPlan(sessionId: $sessionId) {
      id
      sessionId
      version
      contentMd
      content {
        topics {
          id
          title
          description
          status
        }
      }
      instruction
      createdAt
    }
  }
`;

export const UPDATE_TOPIC_STATUS = gql`
  mutation UpdateTopicStatus($sessionId: ID!, $topicId: String!, $status: String!) {
    updateTopicStatus(sessionId: $sessionId, topicId: $topicId, status: $status) {
      id
      sessionId
      version
      contentMd
      content {
        topics {
          id
          title
          description
          status
        }
      }
      instruction
      createdAt
    }
  }
`;

export const START_STUDYING = gql`
  mutation StartStudying($sessionId: ID!) {
    startStudying(sessionId: $sessionId) {
      id
      title
      description
      stage
      createdAt
      updatedAt
    }
  }
`;
