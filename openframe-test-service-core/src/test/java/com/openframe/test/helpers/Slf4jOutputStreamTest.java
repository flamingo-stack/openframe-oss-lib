package com.openframe.test.helpers;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the redaction. These exact lines were logged in full — into the pod log, Loki and the Slack run
 * report — before it existed, which is why each case is a real sample rather than a synthetic one.
 */
class Slf4jOutputStreamTest {

    @Test
    @DisplayName("Session cookies are redacted, and the field name survives")
    void redactsSessionCookies() {
        String line = Slf4jOutputStream.redact(
                "Cookies:\t\taccess_token=eyJraWQiOiJraWQtOTYwZTUzNTQtZjE3Ny00NmRmLWE4YzAtNGMzNGQ0YzMzNTdkIiwiYWxnIjoiUlMyNTYifQ");

        assertThat(line).doesNotContain("eyJraWQ");
        assertThat(line).contains("access_token=<redacted>");
    }

    @Test
    @DisplayName("A refresh token is redacted")
    void redactsRefreshToken() {
        String line = Slf4jOutputStream.redact("\t\t\t\trefresh_token=OvZ0zzAQszY9e6WRekX1tzBV05Y3LIZpu6vrca6Tfxfduo");

        assertThat(line).doesNotContain("OvZ0zzAQszY9");
        assertThat(line).contains("refresh_token=<redacted>");
    }

    @Test
    @DisplayName("The OAuth client secret in form params is redacted")
    void redactsClientSecret() {
        String line = Slf4jOutputStream.redact("\t\t\t\tclient_secret=GAZnNgesYOCAOH8G7UxfaT_ae0L_gLwnd2CgE9ksTmg");

        assertThat(line).doesNotContain("GAZnNges");
        assertThat(line).contains("client_secret=<redacted>");
    }

    @Test
    @DisplayName("A bearer value is redacted wherever it appears")
    void redactsBearer() {
        String line = Slf4jOutputStream.redact("Authorization=Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZ2VudF8");

        assertThat(line).doesNotContain("eyJhbGciOiJSUzI1NiJ9");
        assertThat(line).contains("Bearer <redacted>");
    }

    @Test
    @DisplayName("Several secrets on one line are all redacted")
    void redactsEveryOccurrence() {
        String line = Slf4jOutputStream.redact("access_token=aaa.bbb refresh_token=ccc.ddd");

        assertThat(line).isEqualTo("access_token=<redacted> refresh_token=<redacted>");
    }

    @Test
    @DisplayName("A JSON-encoded token is redacted — the shape the agent token exchange returns")
    void redactsJsonAccessToken() {
        String line = Slf4jOutputStream.redact(
                "    \"accessToken\" : \"eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZ2VudF8wZTk5\",");

        assertThat(line).doesNotContain("eyJhbGciOiJSUzI1NiJ9");
        assertThat(line).contains("\"accessToken\" : \"<redacted>\"");
    }

    @Test
    @DisplayName("Snake case, camel case and a quoted client secret are all covered")
    void redactsJsonVariants() {
        assertThat(Slf4jOutputStream.redact("{\"access_token\":\"aaa bbb\"}"))
                .isEqualTo("{\"access_token\":\"<redacted>\"}");
        assertThat(Slf4jOutputStream.redact("{\"clientSecret\": \"s3cr3t\"}"))
                .isEqualTo("{\"clientSecret\": \"<redacted>\"}");
        assertThat(Slf4jOutputStream.redact("{\"password\":\"Test123!\"}"))
                .isEqualTo("{\"password\":\"<redacted>\"}");
    }

    @Test
    @DisplayName("A value containing spaces is still bounded by its closing quote")
    void redactsWholeQuotedValue() {
        String line = Slf4jOutputStream.redact("{\"token\": \"a b c\", \"id\": \"keep-me\"}");

        assertThat(line).isEqualTo("{\"token\": \"<redacted>\", \"id\": \"keep-me\"}");
    }

    @Test
    @DisplayName("token_type is not a secret and survives")
    void leavesTokenTypeAlone() {
        String line = Slf4jOutputStream.redact("{\"token_type\": \"Bearer\", \"expires_in\": 900}");

        assertThat(line).contains("\"token_type\": \"Bearer\"");
    }

    @Test
    @DisplayName("An ordinary line is untouched")
    void leavesOrdinaryLinesAlone() {
        String line = "Request URI:\thttps://stage.openframe.miami/api/graphql";

        assertThat(Slf4jOutputStream.redact(line)).isEqualTo(line);
    }
}
