use reqwest::Client;
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

const OPENROUTER_API_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

#[derive(Debug, Clone)]
pub struct OpenRouterClient {
    client: Client,
    api_key: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Message {
    role: String,
    content: MessageContent,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
enum MessageContent {
    Text(String),
    Parts(Vec<ContentPart>),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum ContentPart {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image_url")]
    ImageUrl { image_url: ImageUrl },
}

#[derive(Debug, Serialize, Deserialize)]
struct ImageUrl {
    url: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    content: String,
}

impl OpenRouterClient {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }

    /// Send a chat completion request (text only)
    pub async fn chat(
        &self,
        model: &str,
        system_prompt: &str,
        user_message: &str,
    ) -> Result<String, async_graphql::Error> {
        let request = ChatRequest {
            model: model.to_string(),
            messages: vec![
                Message {
                    role: "system".to_string(),
                    content: MessageContent::Text(system_prompt.to_string()),
                },
                Message {
                    role: "user".to_string(),
                    content: MessageContent::Text(user_message.to_string()),
                },
            ],
            max_tokens: None,
        };

        self.send_request(request).await
    }

    /// Send a chat completion request with conversation history
    pub async fn chat_with_history(
        &self,
        model: &str,
        system_prompt: &str,
        history: Vec<(String, String)>, // (role, content)
        user_message: &str,
    ) -> Result<String, async_graphql::Error> {
        let mut messages = vec![Message {
            role: "system".to_string(),
            content: MessageContent::Text(system_prompt.to_string()),
        }];

        // Add history
        for (role, content) in history {
            messages.push(Message {
                role,
                content: MessageContent::Text(content),
            });
        }

        // Add current user message
        messages.push(Message {
            role: "user".to_string(),
            content: MessageContent::Text(user_message.to_string()),
        });

        let request = ChatRequest {
            model: model.to_string(),
            messages,
            max_tokens: None,
        };

        self.send_request(request).await
    }

    /// Extract text from an image using vision model
    pub async fn extract_text_from_image(
        &self,
        model: &str,
        image_base64: &str,
        mime_type: &str,
    ) -> Result<String, async_graphql::Error> {
        let prompt = r#"You are extracting content from an academic document page.

Extract ALL text from this page exactly as shown, preserving the original language.

For any mathematical formulas, equations, chemical formulas, or scientific notation:
- Represent them in LaTeX format using $...$ for inline math and $$...$$ for block equations
- Preserve the exact meaning and structure of the formulas

For tables:
- Format them clearly with proper alignment

For bullet points and numbered lists:
- Preserve the structure

IMPORTANT: Keep the text in its original language (Portuguese, English, Spanish, etc.). Do not translate.

Output the extracted content in plain text with LaTeX formulas embedded where appropriate.
Do not add any commentary or explanations - just extract the content as-is."#;

        let data_url = format!("data:{};base64,{}", mime_type, image_base64);

        let request = ChatRequest {
            model: model.to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: MessageContent::Parts(vec![
                    ContentPart::Text {
                        text: prompt.to_string(),
                    },
                    ContentPart::ImageUrl {
                        image_url: ImageUrl { url: data_url },
                    },
                ]),
            }],
            max_tokens: Some(4096),
        };

        self.send_request(request).await
    }

    async fn send_request(&self, request: ChatRequest) -> Result<String, async_graphql::Error> {
        let response = self
            .client
            .post(OPENROUTER_API_URL)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .header("HTTP-Referer", "https://caky.app")
            .header("X-Title", "Caky")
            .json(&request)
            .send()
            .await
            .map_err(|e| async_graphql::Error::new(format!("OpenRouter request failed: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(async_graphql::Error::new(format!(
                "OpenRouter API error: {}",
                error_text
            )));
        }

        let chat_response: ChatResponse = response
            .json()
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to parse response: {}", e)))?;

        chat_response
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| async_graphql::Error::new("No response from AI"))
    }
}

/// Encode bytes to base64
pub fn encode_base64(data: &[u8]) -> String {
    BASE64.encode(data)
}
