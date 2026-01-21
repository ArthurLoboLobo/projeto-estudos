use async_graphql::SimpleObject;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::storage::profiles::ProfileRow;

#[derive(SimpleObject, Clone)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub created_at: DateTime<Utc>,
}

impl From<ProfileRow> for User {
    fn from(row: ProfileRow) -> Self {
        Self {
            id: row.id,
            email: row.email,
            created_at: row.created_at,
        }
    }
}
