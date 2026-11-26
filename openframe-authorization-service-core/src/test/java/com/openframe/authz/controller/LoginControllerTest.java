package com.openframe.authz.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.ui.ConcurrentModel;
import org.springframework.ui.Model;

import static org.assertj.core.api.Assertions.assertThat;

class LoginControllerTest {

    private static final String PASSWORD_RESET_URL = "https://openframe.ai/sas/password-reset/request";
    private static final String SITE_KEY = "6LcSiteKey";
    private static final String SESSION_SITE_KEY = "6LcSessionSiteKey";

    private LoginController controller;
    private Model model;

    @BeforeEach
    void setUp() {
        controller = new LoginController();
        model = new ConcurrentModel();
        ReflectionTestUtils.setField(controller, "passwordResetPageUrl", PASSWORD_RESET_URL);
        ReflectionTestUtils.setField(controller, "recaptchaSiteKey", SITE_KEY);
        ReflectionTestUtils.setField(controller, "recaptchaSessionSiteKey", SESSION_SITE_KEY);
    }

    @Test
    void login_sessionKeyConfigured_sessionKeyReplacesSiteKey() {
        // execution
        String view = controller.login(model, null);

        // verifications
        assertThat(view).isEqualTo("login");
        assertThat(model.asMap())
                .containsEntry("passwordResetUrl", PASSWORD_RESET_URL)
                .containsEntry("recaptchaSessionSiteKey", SESSION_SITE_KEY)
                .doesNotContainKeys("recaptchaSiteKey", "errorMessage");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " "})
    void login_blankSessionKey_siteKeyUsedAsBefore(String sessionSiteKey) {
        // setup
        ReflectionTestUtils.setField(controller, "recaptchaSessionSiteKey", sessionSiteKey);

        // execution
        controller.login(model, null);

        // verifications
        assertThat(model.asMap())
                .containsEntry("passwordResetUrl", PASSWORD_RESET_URL)
                .containsEntry("recaptchaSiteKey", SITE_KEY)
                .doesNotContainKey("recaptchaSessionSiteKey");
    }

    @Test
    void login_noKeys_resetOfferedWithoutRecaptcha() {
        // setup
        ReflectionTestUtils.setField(controller, "recaptchaSiteKey", "");
        ReflectionTestUtils.setField(controller, "recaptchaSessionSiteKey", "");

        // execution
        controller.login(model, null);

        // verifications
        assertThat(model.asMap())
                .containsEntry("passwordResetUrl", PASSWORD_RESET_URL)
                .doesNotContainKeys("recaptchaSiteKey", "recaptchaSessionSiteKey");
    }

    @Test
    void login_noResetPage_sessionKeyStillOnModel() {
        // setup
        ReflectionTestUtils.setField(controller, "passwordResetPageUrl", "");

        // execution
        controller.login(model, null);

        // verifications
        assertThat(model.asMap())
                .containsEntry("recaptchaSessionSiteKey", SESSION_SITE_KEY)
                .doesNotContainKeys("passwordResetUrl", "recaptchaSiteKey");
    }

    @Test
    void login_noResetPageAndNoSessionKey_modelStaysEmpty() {
        // setup
        ReflectionTestUtils.setField(controller, "passwordResetPageUrl", "");
        ReflectionTestUtils.setField(controller, "recaptchaSessionSiteKey", "");

        // execution
        controller.login(model, null);

        // verifications
        assertThat(model.asMap()).isEmpty();
    }

    @Test
    void login_errorParameter_modelCarriesInvalidCredentials() {
        // execution
        controller.login(model, "");

        // verifications
        assertThat(model.asMap()).containsEntry("errorMessage", "Invalid credentials");
    }
}
