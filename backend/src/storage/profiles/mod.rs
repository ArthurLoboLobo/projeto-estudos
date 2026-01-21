use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ProfileRow {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
}

/// Create a new profile
pub async fn create_profile(
    pool: &PgPool,
    email: &str,
    password_hash: &str,
) -> Result<ProfileRow, async_graphql::Error> {
    let profile = sqlx::query_as::<_, ProfileRow>(
        r#"
        INSERT INTO profiles (email, password_hash)
        VALUES ($1, $2)
        RETURNING id, email, password_hash, created_at
        "#,
    )
    .bind(email)
    .bind(password_hash)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(profile)
}

/// Get profile by email
pub async fn get_profile_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<Option<ProfileRow>, async_graphql::Error> {
    let profile = sqlx::query_as::<_, ProfileRow>(
        r#"
        SELECT id, email, password_hash, created_at
        FROM profiles
        WHERE email = $1
        "#,
    )
    .bind(email)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(profile)
}

/// Get profile by ID
pub async fn get_profile_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<ProfileRow>, async_graphql::Error> {
    let profile = sqlx::query_as::<_, ProfileRow>(
        r#"
        SELECT id, email, password_hash, created_at
        FROM profiles
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(profile)
}
