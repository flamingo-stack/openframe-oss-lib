#[allow(unused_variables)]
pub fn lookup(tool_key: &str) -> Option<&'static str> {
    match tool_key {
        #[cfg(feature = "openframe-chat-version")]
        crate::models::CHAT_TOOL_AGENT_ID => Some(env!("OPENFRAME_CHAT_VERSION")),

        #[cfg(feature = "meshcentral-agent-version")]
        "meshcentral-server" => Some(env!("MESHCENTRAL_AGENT_VERSION")),

        #[cfg(feature = "fleetmdm-agent-version")]
        "fleetmdm-server" => Some(env!("FLEETMDM_AGENT_VERSION")),

        #[cfg(feature = "osquery-version")]
        "osqueryd" => Some(env!("OSQUERY_VERSION")),

        _ => None,
    }
}
