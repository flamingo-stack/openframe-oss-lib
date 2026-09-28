use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct HostnameReportMessage {
    pub hostname: String,
}
