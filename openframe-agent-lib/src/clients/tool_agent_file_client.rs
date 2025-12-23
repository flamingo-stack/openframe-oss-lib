use reqwest::Client;
use anyhow::{Context, Result};

#[derive(Clone)]
pub struct ToolAgentFileClient {
    http_client: Client,
    base_url: String,
}

impl ToolAgentFileClient {
    pub fn new(http_client: Client, base_url: String) -> Self {
        Self { http_client, base_url }
    }

    pub async fn get_tool_agent_file(&self, asset_id: String) -> Result<bytes::Bytes> {
        let os_param = if cfg!(target_os = "windows") { "windows" } else { "mac" };
        let url = format!(
            "{}/clients/tool-agent/{}?os={}",
            self.base_url, asset_id, os_param
        );
        let response = self.http_client.get(url).send()
            .await
            .context("Failed to get tool agent file")?;

        let status = response.status();

        if !response.status().is_success() {
            let error_text = response.text().await.context("Failed to read response text")?;
            return Err(anyhow::anyhow!("Failed to get tool agent file with status {} and body {}", status, error_text));
        }

        let body = response.bytes().await?; 
        Ok(body)
    }

}