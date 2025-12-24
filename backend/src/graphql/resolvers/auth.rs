use async_graphql::{Context, Object, Result, SimpleObject};
use sqlx::PgPool;

use crate::config::Config;
use crate::services::auth::{jwt, password};
use crate::storage::users;

use super::super::types::User;

#[derive(SimpleObject)]
pub struct AuthPayload {
    pub token: String,
    pub user: User,
}

pub async fn register(ctx: &Context<'_>, email: String, password: String) -> Result<AuthPayload> {
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    // Check if user already exists
    if users::get_user_by_email(pool, &email).await?.is_some() {
        return Err("User already exists".into());
    }

    // Hash password
    let password_hash = password::hash_password(&password)?;

    // Create user
    let user = users::create_user(pool, &email, &password_hash).await?;

    // Generate JWT
    let token = jwt::create_jwt(user.id, &config.jwt_secret)?;

    Ok(AuthPayload {
        token,
        user: user.into(),
    })
}

pub async fn login(ctx: &Context<'_>, email: String, password: String) -> Result<AuthPayload> {
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    // Find user
    let user = users::get_user_by_email(pool, &email)
        .await?
        .ok_or("Invalid credentials")?;

    // Verify password
    if !password::verify_password(&password, &user.password_hash)? {
        return Err("Invalid credentials".into());
    }

    // Generate JWT
    let token = jwt::create_jwt(user.id, &config.jwt_secret)?;

    Ok(AuthPayload {
        token,
        user: user.into(),
    })
}

