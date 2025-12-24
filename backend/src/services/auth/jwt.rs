use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const JWT_EXPIRATION_DAYS: i64 = 7;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,  // user_id
    pub exp: i64,   // expiration timestamp
    pub iat: i64,   // issued at timestamp
}

/// Create a new JWT for a user
pub fn create_jwt(user_id: Uuid, secret: &str) -> Result<String, async_graphql::Error> {
    let now = Utc::now();
    let exp = now + Duration::days(JWT_EXPIRATION_DAYS);

    let claims = Claims {
        sub: user_id,
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| async_graphql::Error::new(format!("Failed to create JWT: {}", e)))
}

/// Verify a JWT and return the user_id
pub fn verify_jwt(token: &str, secret: &str) -> Result<Uuid, async_graphql::Error> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| async_graphql::Error::new(format!("Invalid JWT: {}", e)))?;

    Ok(token_data.claims.sub)
}

