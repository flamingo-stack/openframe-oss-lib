use std::sync::OnceLock;

use uuid::Uuid;

static SESSION_ID: OnceLock<String> = OnceLock::new();

pub fn session_id() -> &'static str {
    SESSION_ID.get_or_init(|| Uuid::new_v4().to_string())
}

#[cfg(test)]
#[path = "agent_session_tests.rs"]
mod tests;
