use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub supabase_url: String,
    pub supabase_service_key: String,
    pub jwt_secret: String,
    pub openrouter_api_key: String,
    pub server_port: u16,
    pub allowed_origins: Vec<String>,
}

impl Config {
    pub fn from_env() -> Result<Self, env::VarError> {
        let allowed_origins = env::var("ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:5173".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();

        Ok(Self {
            database_url: env::var("DATABASE_URL")?,
            supabase_url: env::var("SUPABASE_URL")?,
            supabase_service_key: env::var("SUPABASE_SERVICE_KEY")?,
            jwt_secret: env::var("JWT_SECRET")?,
            openrouter_api_key: env::var("OPENROUTER_API_KEY").unwrap_or_default(),
            server_port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .unwrap_or(8080),
            allowed_origins,
        })
    }
}

