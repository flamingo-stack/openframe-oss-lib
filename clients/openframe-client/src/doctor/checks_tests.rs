use super::*;
use crate::doctor::{CheckStatus, Remediation};
use crate::platform::dotnet_framework::DOTNET_4_8_RELEASE;

#[test]
fn dotnet_framework_below_4_8_is_offered_the_install() {
    let older = dotnet_framework_result(DOTNET_4_8_RELEASE - 1);
    assert_eq!(older.status, CheckStatus::Warn);
    assert_eq!(older.remediation, Some(Remediation::InstallDotnet48));

    let current = dotnet_framework_result(DOTNET_4_8_RELEASE);
    assert_eq!(current.status, CheckStatus::Pass);
    assert_eq!(current.remediation, None);
}
