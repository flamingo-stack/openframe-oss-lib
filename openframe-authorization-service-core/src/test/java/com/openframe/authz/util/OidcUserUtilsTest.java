package com.openframe.authz.util;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.Map;

import static com.openframe.authz.support.SsoTestFixtures.oidcUser;
import static org.assertj.core.api.Assertions.assertThat;

class OidcUserUtilsTest {

    @Test
    void shouldResolveEmailInPriorityOrder() {
        assertThat(OidcUserUtils.resolveEmail(oidcUser(Map.of(
                "email", "e@x.com", "preferred_username", "p@x.com", "upn", "u@x.com")))).isEqualTo("e@x.com");
        assertThat(OidcUserUtils.resolveEmail(oidcUser(Map.of(
                "preferred_username", "p@x.com", "upn", "u@x.com")))).isEqualTo("p@x.com");
        assertThat(OidcUserUtils.resolveEmail(oidcUser(Map.of("upn", "u@x.com", "unique_name", "n@x.com"))))
                .isEqualTo("u@x.com");
        assertThat(OidcUserUtils.resolveEmail(oidcUser(Map.of("unique_name", "n@x.com")))).isEqualTo("n@x.com");
        assertThat(OidcUserUtils.resolveEmail(oidcUser(Map.of()))).isNull();
    }

    @Test
    void shouldSkipBlankEmailClaims() {
        assertThat(OidcUserUtils.resolveEmail(oidcUser(Map.of("email", " ", "upn", "u@x.com")))).isEqualTo("u@x.com");
    }

    @Test
    void shouldPreferGivenAndFamilyName() {
        String[] names = OidcUserUtils.resolveNames(oidcUser(Map.of(
                "given_name", "Ada", "family_name", "Lovelace", "name", "Someone Else")));

        assertThat(names).containsExactly("Ada", "Lovelace");
    }

    @Test
    void shouldSplitFullNameWhenGivenAndFamilyAreAbsent() {
        assertThat(OidcUserUtils.resolveNames(oidcUser(Map.of("name", "Grace Brewster Hopper"))))
                .containsExactly("Grace", "Brewster Hopper");
        assertThat(OidcUserUtils.resolveNames(oidcUser(Map.of("name", "Cher")))).containsExactly("Cher", "");
    }

    @Test
    void shouldFallBackToEmailLocalPartAndNeverReturnNulls() {
        assertThat(OidcUserUtils.resolveNames(oidcUser(Map.of("email", "linus@kernel.org"))))
                .containsExactly("linus", "");
        assertThat(OidcUserUtils.resolveNames(oidcUser(Map.of()))).containsExactly("", "");
    }

    @Test
    void shouldTreatEmailVerifiedClaimVariants() {
        assertThat(OidcUserUtils.emailVerifiedClaimAllows(Map.of("email_verified", true))).isTrue();
        assertThat(OidcUserUtils.emailVerifiedClaimAllows(Map.of("email_verified", false))).isFalse();
        assertThat(OidcUserUtils.emailVerifiedClaimAllows(Map.of("email_verified", "false"))).isFalse();
        assertThat(OidcUserUtils.emailVerifiedClaimAllows(Map.of("email_verified", "true"))).isTrue();
        assertThat(OidcUserUtils.emailVerifiedClaimAllows(Map.of())).isTrue();
    }

    @Test
    void shouldDescribeTrustSignalsWithoutTheEmail() {
        String described = OidcUserUtils.describeEmailTrustSignals(Map.of(
                "tid", "t-1", "xms_edov", false, "email", "secret@victim.com"));

        assertThat(described)
                .contains("tid=t-1")
                .contains("xms_edov=false")
                .contains("email_verified=absent")
                .doesNotContain("victim");
    }

    @Test
    void shouldResolvePictureOnlyFromPictureClaim() {
        assertThat(OidcUserUtils.resolvePictureUrl(oidcUser(Map.of("picture", "https://img/x.png"))))
                .isEqualTo("https://img/x.png");
        assertThat(OidcUserUtils.resolvePictureUrl(oidcUser(Map.of()))).isNull();
    }

    @Test
    void shouldUseAppleUserParamOnlyForApple() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setParameter("user", "{\"name\":{\"firstName\":\"Tim\",\"lastName\":\"Apple\"}}");
        String[] empty = {"", ""};

        assertThat(AppleUserParam.namesOrAppleFallback(empty, "apple", request)).containsExactly("Tim", "Apple");
        assertThat(AppleUserParam.namesOrAppleFallback(empty, "google", request)).containsExactly("", "");
        assertThat(AppleUserParam.namesOrAppleFallback(empty, "microsoft", request)).containsExactly("", "");
    }

    @Test
    void shouldKeepTokenNamesForAppleWhenPresent() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setParameter("user", "{\"name\":{\"firstName\":\"Param\",\"lastName\":\"Name\"}}");

        assertThat(AppleUserParam.namesOrAppleFallback(new String[]{"Token", ""}, "apple", request))
                .containsExactly("Token", "");
    }

    @Test
    void shouldIgnoreMalformedOrEmptyAppleUserParam() {
        MockHttpServletRequest malformed = new MockHttpServletRequest();
        malformed.setParameter("user", "{not json");
        MockHttpServletRequest noName = new MockHttpServletRequest();
        noName.setParameter("user", "{\"email\":\"x@privaterelay.appleid.com\"}");
        String[] empty = {"", ""};

        assertThat(AppleUserParam.namesOrAppleFallback(empty, "apple", malformed)).isSameAs(empty);
        assertThat(AppleUserParam.namesOrAppleFallback(empty, "apple", noName)).isSameAs(empty);
        assertThat(AppleUserParam.namesOrAppleFallback(empty, "apple", new MockHttpServletRequest())).isSameAs(empty);
    }
}
