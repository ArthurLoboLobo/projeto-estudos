import { gql } from '@apollo/client';

export const GET_ME = gql`
  query GetMe {
    me {
      id
      email
    }
  }
`;

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
      documents {
        id
        fileName
        contentLength
        createdAt
      }
      messages {
        id
        role
        content
        createdAt
      }
    }
  }
`;

