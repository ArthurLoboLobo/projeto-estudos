mod auth;
pub mod document;
pub mod message;
pub mod session;
pub mod planning;

use async_graphql::{Context, Object, Result, ID};

use super::context::GraphQLContext;
use super::types::{Document, Message, Session, StudyPlan, User};

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    /// Health check query
    async fn health(&self) -> &str {
        "OK"
    }

    /// Get current authenticated user
    async fn me(&self, ctx: &Context<'_>) -> Result<Option<User>> {
        let gql_ctx = ctx.data::<GraphQLContext>()?;

        if let Some(user_id) = gql_ctx.user_id {
            let pool = ctx.data::<sqlx::PgPool>()?;
            let user = crate::storage::users::get_user_by_id(pool, user_id).await?;
            Ok(user.map(Into::into))
        } else {
            Ok(None)
        }
    }

    /// Get all study sessions for the authenticated user
    async fn sessions(&self, ctx: &Context<'_>) -> Result<Vec<Session>> {
        session::get_sessions(ctx).await
    }

    /// Get a specific study session by ID
    async fn session(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Session>> {
        session::get_session(ctx, id).await
    }

    /// Get all documents for a session
    async fn documents(&self, ctx: &Context<'_>, session_id: ID) -> Result<Vec<Document>> {
        document::get_documents(ctx, session_id).await
    }

    /// Get a signed URL to view a document
    async fn document_url(&self, ctx: &Context<'_>, id: ID) -> Result<String> {
        document::get_document_url(ctx, id).await
    }

    /// Get all messages for a session
    async fn messages(&self, ctx: &Context<'_>, session_id: ID) -> Result<Vec<Message>> {
        message::get_messages(ctx, session_id).await
    }

    /// Get the current study plan for a session
    async fn study_plan(&self, ctx: &Context<'_>, session_id: ID) -> Result<Option<StudyPlan>> {
        planning::get_study_plan(ctx, session_id).await
    }

    /// Get the study plan version history for undo functionality
    async fn study_plan_history(&self, ctx: &Context<'_>, session_id: ID) -> Result<Vec<StudyPlan>> {
        planning::get_study_plan_history(ctx, session_id).await
    }
}

pub struct MutationRoot;

#[Object]
impl MutationRoot {
    /// Register a new user
    async fn register(
        &self,
        ctx: &Context<'_>,
        email: String,
        password: String,
    ) -> Result<auth::AuthPayload> {
        auth::register(ctx, email, password).await
    }

    /// Login with email and password
    async fn login(
        &self,
        ctx: &Context<'_>,
        email: String,
        password: String,
    ) -> Result<auth::AuthPayload> {
        auth::login(ctx, email, password).await
    }

    /// Create a new study session
    async fn create_session(
        &self,
        ctx: &Context<'_>,
        title: String,
        description: Option<String>,
    ) -> Result<Session> {
        session::create_session(ctx, title, description).await
    }

    /// Update an existing study session
    async fn update_session(
        &self,
        ctx: &Context<'_>,
        id: ID,
        input: session::UpdateSessionInput,
    ) -> Result<Option<Session>> {
        session::update_session(ctx, id, input).await
    }

    /// Delete a study session
    async fn delete_session(&self, ctx: &Context<'_>, id: ID) -> Result<bool> {
        session::delete_session(ctx, id).await
    }

    /// Add a document to a session (triggers PDF processing with vision AI)
    async fn add_document(
        &self,
        ctx: &Context<'_>,
        session_id: ID,
        file_path: String,
        file_name: String,
    ) -> Result<Document> {
        document::add_document(ctx, session_id, file_path, file_name).await
    }

    /// Delete a document
    async fn delete_document(&self, ctx: &Context<'_>, id: ID) -> Result<bool> {
        document::delete_document(ctx, id).await
    }

    /// Send a message and get AI response
    async fn send_message(
        &self,
        ctx: &Context<'_>,
        session_id: ID,
        content: String,
    ) -> Result<Message> {
        message::send_message(ctx, session_id, content).await
    }

    /// Clear all messages in a session
    async fn clear_messages(&self, ctx: &Context<'_>, session_id: ID) -> Result<bool> {
        message::clear_messages(ctx, session_id).await
    }

    /// Start the planning phase - generates initial study plan from documents
    async fn start_planning(&self, ctx: &Context<'_>, session_id: ID) -> Result<StudyPlan> {
        planning::start_planning(ctx, session_id).await
    }

    /// Revise the study plan based on user instruction
    async fn revise_study_plan(
        &self,
        ctx: &Context<'_>,
        session_id: ID,
        instruction: String,
    ) -> Result<StudyPlan> {
        planning::revise_study_plan(ctx, session_id, instruction).await
    }

    /// Undo the last study plan revision
    async fn undo_study_plan(&self, ctx: &Context<'_>, session_id: ID) -> Result<StudyPlan> {
        planning::undo_study_plan(ctx, session_id).await
    }

    /// Update a topic's knowledge status
    async fn update_topic_status(
        &self,
        ctx: &Context<'_>,
        session_id: ID,
        topic_id: String,
        status: String,
    ) -> Result<StudyPlan> {
        planning::update_topic_status(ctx, session_id, topic_id, status).await
    }

    /// Finalize the plan and start studying
    async fn start_studying(&self, ctx: &Context<'_>, session_id: ID) -> Result<Session> {
        planning::start_studying(ctx, session_id).await
    }
}
