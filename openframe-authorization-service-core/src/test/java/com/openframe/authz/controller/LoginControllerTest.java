package com.openframe.authz.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.ui.ConcurrentModel;
import org.springframework.ui.Model;

import static org.assertj.core.api.Assertions.assertThat;

class LoginControllerTest {

    private static final String PASSWORD_RESET_URL = "https://openframe.ai/sas/password-reset/request";
    private static final String SITE_KEY = "6LcSiteKey";

    private LoginController controller;
    private Model model;

    @BeforeEach
    void setUp() {
        controller = new LoginController();
        model = new ConcurrentModel();
        ReflectionTestUtils.setField(controller, "passwordResetPageUrl", PASSWORD_RESET_URL);
        ReflectionTestUtils.setField(controller, "recaptchaSiteKey", SITE_KEY);
    }

    @Test
    void login_resetAndSiteKeyConfigured_modelCarriesBoth() {
        // execution
        String view = controller.login(model, null);

        // verifications
        assertThat(view).isEqualTo("login");
        assertThat(model.getAttribute("passwordResetUrl")).isEqualTo(PASSWORD_RESET_URL);
        assertThat(model.getAttribute("recaptchaSiteKey")).isEqualTo(SITE_KEY);
    }

    @Test
    void login_noSiteKey_resetOfferedWithoutRecaptcha() {
        // setup
        ReflectionTestUtils.setField(controller, "recaptchaSiteKey", "");

        // execution
        controller.login(model, null);

        // verifications
        assertThat(model.getAttribute("passwordResetUrl")).isEqualTo(PASSWORD_RESET_URL);
        assertThat(model.containsAttribute("recaptchaSiteKey")).isFalse();
    }

    @Test
    void login_noResetPage_noRecaptchaEither() {
        // setup
        ReflectionTestUtils.setField(controller, "passwordResetPageUrl", "");

        // execution
        controller.login(model, null);

        // verifications
        assertThat(model.containsAttribute("passwordResetUrl")).isFalse();
        assertThat(model.containsAttribute("recaptchaSiteKey")).isFalse();
    }
}
