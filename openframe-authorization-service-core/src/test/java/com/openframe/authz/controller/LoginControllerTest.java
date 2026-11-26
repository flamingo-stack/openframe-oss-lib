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
    private static final String SESSION_SITE_KEY = "6LcSessionSiteKey";

    private LoginController controller;
    private Model model;

    @BeforeEach
    void setUp() {
        controller = new LoginController();
        model = new ConcurrentModel();
        ReflectionTestUtils.setField(controller, "passwordResetPageUrl", PASSWORD_RESET_URL);
        ReflectionTestUtils.setField(controller, "recaptchaSessionSiteKey", SESSION_SITE_KEY);
    }

    @Test
    void login_resetAndSessionKeyConfigured_modelCarriesBoth() {
        // execution
        String view = controller.login(model, null);

        // verifications
        assertThat(view).isEqualTo("login");
        assertThat(model.asMap())
                .containsEntry("passwordResetUrl", PASSWORD_RESET_URL)
                .containsEntry("recaptchaSessionSiteKey", SESSION_SITE_KEY)
                .doesNotContainKey("errorMessage");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " "})
    void login_blankSessionKey_resetOfferedWithoutRecaptcha(String sessionSiteKey) {
        // setup
        ReflectionTestUtils.setField(controller, "recaptchaSessionSiteKey", sessionSiteKey);

        // execution
        controller.login(model, null);

        // verifications
        assertThat(model.asMap())
                .containsEntry("passwordResetUrl", PASSWORD_RESET_URL)
                .doesNotContainKey("recaptchaSessionSiteKey");
    }

    @Test
    void login_noResetPage_sessionKeyStillOnModel() {
        // setup
        ReflectionTestUtils.setField(controller, "passwordResetPageUrl", "");

        // execution
        controller.login(model, null);

        // verifications
        assertThat(model.asMap())
                .doesNotContainKey("passwordResetUrl")
                .containsEntry("recaptchaSessionSiteKey", SESSION_SITE_KEY);
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
