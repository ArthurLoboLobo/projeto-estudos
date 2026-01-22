use uuid::Uuid;

/// GraphQL context that holds authenticated user info
#[derive(Debug, Clone, Default)]
pub struct GraphQLContext {
    pub user_id: Option<Uuid>,
    pub language: String,
}

impl GraphQLContext {
    pub fn new(language: String) -> Self {
        Self { 
            user_id: None,
            language,
        }
    }

    pub fn authenticated(user_id: Uuid, language: String) -> Self {
        Self {
            user_id: Some(user_id),
            language,
        }
    }

    /// Returns the user_id or an error if not authenticated
    pub fn require_auth(&self) -> Result<Uuid, async_graphql::Error> {
        self.user_id
            .ok_or_else(|| async_graphql::Error::new("Unauthorized"))
    }
}

