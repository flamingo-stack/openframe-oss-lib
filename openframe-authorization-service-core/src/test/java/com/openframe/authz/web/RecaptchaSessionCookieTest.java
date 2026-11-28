package com.openframe.authz.web;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class RecaptchaSessionCookieTest {

    private final MockHttpServletRequest request = new MockHttpServletRequest();

    @Test
    void presentIn_cookieWithValue_true() {
        // setup
        request.setCookies(new Cookie("JSESSIONID", "s"), new Cookie(RecaptchaSessionCookie.NAME, "token"));

        // execution
        boolean present = RecaptchaSessionCookie.presentIn(request);

        // verifications
        assertThat(present).isTrue();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void presentIn_cookieWithoutValue_false(String value) {
        // setup
        request.setCookies(new Cookie(RecaptchaSessionCookie.NAME, value));

        // execution
        boolean present = RecaptchaSessionCookie.presentIn(request);

        // verifications
        assertThat(present).isFalse();
    }

    @Test
    void presentIn_otherCookiesOnly_false() {
        // setup
        request.setCookies(new Cookie("JSESSIONID", "s"));

        // execution
        boolean present = RecaptchaSessionCookie.presentIn(request);

        // verifications
        assertThat(present).isFalse();
    }

    @Test
    void presentIn_noCookies_false() {
        // execution
        boolean present = RecaptchaSessionCookie.presentIn(request);

        // verifications
        assertThat(present).isFalse();
    }
}
