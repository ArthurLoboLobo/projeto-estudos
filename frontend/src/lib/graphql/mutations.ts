import { gql } from '@apollo/client';

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

export const CREATE_SESSION = gql`
  mutation CreateSession($title: String!, $description: String) {
    createSession(title: $title, description: $description) {
      id
      title
      description
    }
  }
`;

export const ADD_DOCUMENT = gql`
  mutation AddDocument($sessionId: ID!, $filePath: String!, $fileName: String!) {
    addDocument(sessionId: $sessionId, filePath: $filePath, fileName: $fileName) {
      id
      fileName
      contentLength
    }
  }
`;

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

