use async_graphql::{EmptySubscription, Schema};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    extract::State,
    http::HeaderMap,
    response::{Html, IntoResponse},
};
use sqlx::PgPool;

use crate::config::Config;
use crate::services::auth::jwt::verify_jwt;

use super::context::GraphQLContext;
use super::resolvers::{MutationRoot, QueryRoot};

pub type AppSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

#[derive(Clone)]
pub struct AppState {
    pub schema: AppSchema,
    pub config: Config,
}

pub fn create_schema(pool: PgPool, config: Config) -> AppState {
    let schema = Schema::build(QueryRoot, MutationRoot, EmptySubscription)
        .data(pool)
        .data(config.clone())
        .finish();

    AppState { schema, config }
}

pub async fn graphql_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    req: GraphQLRequest,
) -> GraphQLResponse {
    // Extract JWT from Authorization header
    let ctx = extract_context(&headers, &state.config);

    state
        .schema
        .execute(req.into_inner().data(ctx))
        .await
        .into()
}

fn extract_context(headers: &HeaderMap, config: &Config) -> GraphQLContext {
    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));

    if let Some(token) = auth_header {
        if let Ok(user_id) = verify_jwt(token, &config.jwt_secret) {
            return GraphQLContext::authenticated(user_id);
        }
    }

    GraphQLContext::new()
}

pub async fn graphql_playground() -> impl IntoResponse {
    Html(
        async_graphql::http::playground_source(
            async_graphql::http::GraphQLPlaygroundConfig::new("/graphql"),
        ),
    )
}
