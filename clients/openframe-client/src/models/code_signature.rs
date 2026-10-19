use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CodeSignatureStatus {
    Valid,
    Invalid,
    Unsigned,
}

/// Identity of whoever signed the running binary, as verified by the OS:
/// the Apple Team ID on macOS, the certificate's simple name on Windows.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeSignature {
    pub status: CodeSignatureStatus,
    #[serde(skip_serializing_if = "String::is_empty", default)]
    pub signer: String,
}

impl CodeSignature {
    pub fn valid(signer: String) -> Self {
        Self {
            status: CodeSignatureStatus::Valid,
            signer,
        }
    }

    pub fn invalid() -> Self {
        Self {
            status: CodeSignatureStatus::Invalid,
            signer: String::new(),
        }
    }

    pub fn unsigned() -> Self {
        Self {
            status: CodeSignatureStatus::Unsigned,
            signer: String::new(),
        }
    }
}

#[cfg(test)]
#[path = "code_signature_tests.rs"]
mod tests;
