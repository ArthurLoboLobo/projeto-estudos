use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct UserRow {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
}

/// Create a new user
pub async fn create_user(
    pool: &PgPool,
    email: &str,
    password_hash: &str,
) -> Result<UserRow, async_graphql::Error> {
    let user = sqlx::query_as::<_, UserRow>(
        r#"
        INSERT INTO users (email, password_hash)
        VALUES ($1, $2)
        RETURNING id, email, password_hash, created_at
        "#,
    )
    .bind(email)
    .bind(password_hash)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(user)
}

/// Get user by email
pub async fn get_user_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<Option<UserRow>, async_graphql::Error> {
    let user = sqlx::query_as::<_, UserRow>(
        r#"
        SELECT id, email, password_hash, created_at
        FROM users
        WHERE email = $1
        "#,
    )
    .bind(email)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(user)
}

/// Get user by ID
pub async fn get_user_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<UserRow>, async_graphql::Error> {
    let user = sqlx::query_as::<_, UserRow>(
        r#"
        SELECT id, email, password_hash, created_at
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(user)
}

