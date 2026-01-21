use async_graphql::{Context, Result, SimpleObject};
use sqlx::PgPool;

use crate::config::Config;
use crate::services::auth::{jwt, password};
use crate::storage::profiles;

use super::super::types::User;

#[derive(SimpleObject)]
pub struct AuthPayload {
    pub token: String,
    pub user: User,
}

pub async fn register(ctx: &Context<'_>, email: String, password: String) -> Result<AuthPayload> {
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    // Check if profile already exists
    if profiles::get_profile_by_email(pool, &email).await?.is_some() {
        return Err("User already exists".into());
    }

    // Hash password
    let password_hash = password::hash_password(&password)?;

    // Create profile
    let profile = profiles::create_profile(pool, &email, &password_hash).await?;

    // Generate JWT
    let token = jwt::create_jwt(profile.id, &config.jwt_secret)?;

    Ok(AuthPayload {
        token,
        user: profile.into(),
    })
}

pub async fn login(ctx: &Context<'_>, email: String, password: String) -> Result<AuthPayload> {
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    // Find profile
    let profile = profiles::get_profile_by_email(pool, &email)
        .await?
        .ok_or("Invalid credentials")?;

    // Verify password
    if !password::verify_password(&password, &profile.password_hash)? {
        return Err("Invalid credentials".into());
    }

    // Generate JWT
    let token = jwt::create_jwt(profile.id, &config.jwt_secret)?;

    Ok(AuthPayload {
        token,
        user: profile.into(),
    })
}
