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

export const UPDATE_SESSION = gql`
  mutation UpdateSession($id: ID!, $input: UpdateSessionInput!) {
    updateSession(id: $id, input: $input) {
      id
      title
      description
      status
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

export const DELETE_DOCUMENT = gql`
  mutation DeleteDocument($id: ID!) {
    deleteDocument(id: $id)
  }
`;

// ============ PLANNING PHASE ============

export const GENERATE_PLAN = gql`
  mutation GeneratePlan($sessionId: ID!) {
    generatePlan(sessionId: $sessionId) {
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

export const REVISE_PLAN = gql`
  mutation RevisePlan($sessionId: ID!, $instruction: String!) {
    revisePlan(sessionId: $sessionId, instruction: $instruction) {
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

export const UPDATE_DRAFT_TOPIC_COMPLETION = gql`
  mutation UpdateDraftTopicCompletion($sessionId: ID!, $topicId: String!, $isCompleted: Boolean!) {
    updateDraftTopicCompletion(sessionId: $sessionId, topicId: $topicId, isCompleted: $isCompleted) {
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

export const START_STUDYING = gql`
  mutation StartStudying($sessionId: ID!) {
    startStudying(sessionId: $sessionId) {
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

// ============ TOPICS ============

export const UPDATE_TOPIC_COMPLETION = gql`
  mutation UpdateTopicCompletion($id: ID!, $isCompleted: Boolean!) {
    updateTopicCompletion(id: $id, isCompleted: $isCompleted) {
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

// ============ MESSAGES ============

export const SEND_MESSAGE = gql`
  mutation SendMessage($chatId: ID!, $content: String!) {
    sendMessage(chatId: $chatId, content: $content) {
      id
      chatId
      role
      content
      createdAt
    }
  }
`;

export const CLEAR_MESSAGES = gql`
  mutation ClearMessages($chatId: ID!) {
    clearMessages(chatId: $chatId)
  }
`;

export const GENERATE_WELCOME = gql`
  mutation GenerateWelcome($chatId: ID!) {
    generateWelcome(chatId: $chatId) {
      id
      chatId
      role
      content
      createdAt
    }
  }
`;
