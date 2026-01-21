mod auth;
pub mod document;
pub mod message;
pub mod session;
pub mod planning;
pub mod topic;
pub mod chat;

use async_graphql::{Context, Object, Result, ID};

use super::context::GraphQLContext;
use super::types::{Chat, Document, Message, Session, Topic, User};

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

        if let Some(profile_id) = gql_ctx.user_id {
            let pool = ctx.data::<sqlx::PgPool>()?;
            let profile = crate::storage::profiles::get_profile_by_id(pool, profile_id).await?;
            Ok(profile.map(Into::into))
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

    /// Get all topics for a session (only available after starting studying)
    async fn topics(&self, ctx: &Context<'_>, session_id: ID) -> Result<Vec<Topic>> {
        topic::get_topics(ctx, session_id).await
    }

    /// Get a specific topic by ID
    async fn topic(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Topic>> {
        topic::get_topic(ctx, id).await
    }

    /// Get all chats for a session (only available after starting studying)
    async fn chats(&self, ctx: &Context<'_>, session_id: ID) -> Result<Vec<Chat>> {
        chat::get_chats(ctx, session_id).await
    }

    /// Get a specific chat by ID
    async fn chat(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Chat>> {
        chat::get_chat(ctx, id).await
    }

    /// Get the chat for a specific topic
    async fn chat_by_topic(&self, ctx: &Context<'_>, topic_id: ID) -> Result<Option<Chat>> {
        chat::get_chat_by_topic(ctx, topic_id).await
    }

    /// Get the review chat for a session
    async fn review_chat(&self, ctx: &Context<'_>, session_id: ID) -> Result<Option<Chat>> {
        chat::get_review_chat(ctx, session_id).await
    }

    /// Get all messages for a chat
    async fn messages(&self, ctx: &Context<'_>, chat_id: ID) -> Result<Vec<Message>> {
        message::get_messages(ctx, chat_id).await
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

    // ===== Session Management =====

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

    // ===== Document Management =====

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

    // ===== Planning Phase =====

    /// Generate the initial study plan from documents (stores as draft_plan)
    async fn generate_plan(&self, ctx: &Context<'_>, session_id: ID) -> Result<Session> {
        planning::generate_plan(ctx, session_id).await
    }

    /// Revise the draft study plan based on user instruction
    async fn revise_plan(
        &self,
        ctx: &Context<'_>,
        session_id: ID,
        instruction: String,
    ) -> Result<Session> {
        planning::revise_plan(ctx, session_id, instruction).await
    }

    /// Update a topic's completion status in the draft plan (pre-filtering)
    async fn update_draft_topic_completion(
        &self,
        ctx: &Context<'_>,
        session_id: ID,
        topic_id: String,
        is_completed: bool,
    ) -> Result<Session> {
        planning::update_draft_topic_completion(ctx, session_id, topic_id, is_completed).await
    }

    /// Finalize the plan and start studying (materializes topics and creates chats)
    async fn start_studying(&self, ctx: &Context<'_>, session_id: ID) -> Result<Session> {
        planning::start_studying(ctx, session_id).await
    }

    // ===== Topic Management =====

    /// Mark a topic as completed or not completed
    async fn update_topic_completion(
        &self,
        ctx: &Context<'_>,
        id: ID,
        is_completed: bool,
    ) -> Result<Topic> {
        topic::update_topic_completion(ctx, id, is_completed).await
    }

    // ===== Chat & Messages =====

    /// Send a message to a chat and get AI response
    async fn send_message(
        &self,
        ctx: &Context<'_>,
        chat_id: ID,
        content: String,
    ) -> Result<Message> {
        message::send_message(ctx, chat_id, content).await
    }

    /// Clear all messages in a chat
    async fn clear_messages(&self, ctx: &Context<'_>, chat_id: ID) -> Result<bool> {
        message::clear_messages(ctx, chat_id).await
    }

    /// Generate the initial welcome message from the AI tutor (for empty chats)
    async fn generate_welcome(&self, ctx: &Context<'_>, chat_id: ID) -> Result<Message> {
        message::generate_welcome(ctx, chat_id).await
    }
}
