package com.openframe.authz.security;

import com.openframe.authz.config.oidc.MicrosoftSSOProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class EmailTrustPolicyTest {

    private static final String PERSONAL_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad";

    private final EmailTrustPolicy policy = new EmailTrustPolicy(new MicrosoftSSOProperties());

    private static Map<String, Object> claims(Object... kv) {
        Map<String, Object> map = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            map.put((String) kv[i], kv[i + 1]);
        }
        return map;
    }

    @ParameterizedTest
    @ValueSource(strings = {"google", "apple"})
    void shouldTrustVerifiedEmailFromGoogleAndApple(String provider) {
        assertThat(policy.emailTrustedForRouting(provider, claims("email_verified", true))).isTrue();
        assertThat(policy.emailTrustedForRouting(provider, claims("email_verified", "true"))).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"google", "apple"})
    void shouldNotTrustUnverifiedEmailFromGoogleAndApple(String provider) {
        assertThat(policy.emailTrustedForRouting(provider, claims("email_verified", false))).isFalse();
        assertThat(policy.emailTrustedForRouting(provider, claims("email_verified", "FALSE"))).isFalse();
    }

    @Test
    void shouldTrustGoogleEmailWhenVerifiedClaimIsAbsent() {
        // Pinned: an absent email_verified claim counts as verified for non-Microsoft providers.
        assertThat(policy.emailTrustedForRouting("google", claims())).isTrue();
    }

    @Test
    void shouldTrustMicrosoftPersonalAccountsWithoutDomainOwnershipSignal() {
        assertThat(policy.emailTrustedForRouting("microsoft", claims("tid", PERSONAL_TENANT))).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"true", "TRUE", "True"})
    void shouldTrustMicrosoftOrgTokenWithDomainOwnershipSignalAsString(String edov) {
        assertThat(policy.emailTrustedForRouting("microsoft", claims("tid", "org-tenant", "xms_edov", edov))).isTrue();
    }

    @Test
    void shouldTrustMicrosoftOrgTokenWithBooleanSignals() {
        assertThat(policy.emailTrustedForRouting("microsoft", claims("tid", "org", "xms_edov", true))).isTrue();
        assertThat(policy.emailTrustedForRouting("microsoft", claims("tid", "org", "email_verified", true))).isTrue();
    }

    @Test
    void shouldNotTrustMicrosoftOrgTokenWithoutSignals() {
        assertThat(policy.emailTrustedForRouting("microsoft", claims("tid", "attacker-directory"))).isFalse();
    }

    @Test
    void shouldNotTrustMicrosoftOrgTokenWithNegativeSignals() {
        assertThat(policy.emailTrustedForRouting("microsoft",
                claims("tid", "org", "xms_edov", false, "email_verified", false))).isFalse();
        assertThat(policy.emailTrustedForRouting("microsoft", claims("tid", "org", "xms_edov", "false"))).isFalse();
    }

    @Test
    void shouldNotTrustMicrosoftEmailVerifiedWhenSentAsString() {
        // Only a boolean email_verified counts for Microsoft org tokens.
        assertThat(policy.emailTrustedForRouting("microsoft", claims("tid", "org", "email_verified", "true"))).isFalse();
    }
}
