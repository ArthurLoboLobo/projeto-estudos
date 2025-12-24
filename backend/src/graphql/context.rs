use uuid::Uuid;

/// GraphQL context that holds authenticated user info
#[derive(Debug, Clone, Default)]
pub struct GraphQLContext {
    pub user_id: Option<Uuid>,
}

impl GraphQLContext {
    pub fn new() -> Self {
        Self { user_id: None }
    }

    pub fn authenticated(user_id: Uuid) -> Self {
        Self {
            user_id: Some(user_id),
        }
    }

    /// Returns the user_id or an error if not authenticated
    pub fn require_auth(&self) -> Result<Uuid, async_graphql::Error> {
        self.user_id
            .ok_or_else(|| async_graphql::Error::new("Unauthorized"))
    }
}

