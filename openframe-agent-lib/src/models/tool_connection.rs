use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct ToolConnection {
    pub tool_agent_id: String,
    pub agent_tool_id: String,
    pub published: bool,
}
