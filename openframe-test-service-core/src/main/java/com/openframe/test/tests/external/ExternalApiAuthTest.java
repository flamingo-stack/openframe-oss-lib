package com.openframe.test.tests.external;

import com.openframe.test.config.ExternalApiConfig;
import com.openframe.test.data.dto.external.common.ExternalErrorResponse;
import io.restassured.response.Response;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.condition.EnabledIf;

import static com.openframe.test.helpers.RequestSpecHelper.getExternalApiSpec;
import static com.openframe.test.helpers.RequestSpecHelper.getExternalApiSpecNoKey;
import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * The gateway's API-key gate on {@code /external-api/**}.
 *
 * <p>This is the only thing standing between the public internet and the External API:
 * {@code GatewaySecurityConfig} has no {@code pathMatchers} rule for {@code /external-api/**}, so Spring
 * Security permits it and {@code ApiKeyAuthenticationFilter} is the sole authority. It had no test
 * coverage before this suite.
 */
@Tag("saas")
@Tag("external-api")
@EnabledIf(ExternalApiBaseTest.EXTERNAL_API_KEY_CONDITION)
@DisplayName("External API - Authentication")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class ExternalApiAuthTest extends ExternalApiBaseTest {

    /** Any cheap, unpaginated read; this suite is about the gate, not the resource. */
    private static final String PROBE_ENDPOINT = "api/v1/tools";

    private static final String UNAUTHORIZED = "UNAUTHORIZED";

    @BeforeAll
    public static void logKey() {
        logActor();
    }

    @Tag("feature")
    @Tag("read")
    @Order(1)
    @Test
    @DisplayName("Valid API key is accepted")
    public void testValidKeyIsAccepted() {
        Response response = given(getExternalApiSpec()).get(PROBE_ENDPOINT);
        assertThat(response.getStatusCode())
                .as("A valid X-API-Key should be accepted; body was %s", response.getBody().asString())
                .isEqualTo(200);
    }

    @Tag("feature")
    @Tag("injection")
    @Order(2)
    @Test
    @DisplayName("Request without an API key is rejected")
    public void testMissingKeyIsRejected() {
        ExternalErrorResponse error = given(getExternalApiSpecNoKey())
                .get(PROBE_ENDPOINT)
                .then().statusCode(401)
                .extract().as(ExternalErrorResponse.class);

        assertThat(error.getCode()).as("Error code for a missing key").isEqualTo(UNAUTHORIZED);
        assertThat(error.getMessage()).as("Message should name the protected path prefix")
                .contains("/external-api");
    }

    @Tag("feature")
    @Tag("injection")
    @Order(3)
    @Test
    @DisplayName("Malformed API key is rejected")
    public void testMalformedKeyIsRejected() {
        ExternalErrorResponse error = attemptWithKey("not-a-key", 401);
        assertThat(error.getCode()).as("Error code for a malformed key").isEqualTo(UNAUTHORIZED);
    }

    @Tag("feature")
    @Tag("injection")
    @Order(4)
    @Test
    @DisplayName("Well-formed but unknown API key is rejected")
    public void testUnknownKeyIsRejected() {
        // Correct ak_/sk_ shape and length, so this gets past format validation and is rejected on lookup
        // rather than on parsing — a different branch of the filter from the malformed case above.
        String unknown = "ak_0123456789abcdef.sk_0123456789abcdef0123456789abcdef";
        ExternalErrorResponse error = attemptWithKey(unknown, 401);
        assertThat(error.getCode()).as("Error code for an unknown key").isEqualTo(UNAUTHORIZED);
    }

    @Tag("feature")
    @Tag("injection")
    @Order(5)
    @Test
    @DisplayName("Empty API key header is rejected")
    public void testEmptyKeyIsRejected() {
        ExternalErrorResponse error = attemptWithKey("", 401);
        assertThat(error.getCode()).as("Error code for an empty key").isEqualTo(UNAUTHORIZED);
    }

    @Tag("feature")
    @Tag("safety")
    @Order(6)
    @Test
    @DisplayName("Spoofed X-User-Id header does not bypass the gateway")
    public void testSpoofedUserIdHeaderIsIgnored() {
        // The gateway derives X-User-Id from the validated key and overwrites whatever the caller sent.
        // A client-supplied value must never be trusted; if this ever starts returning 200 for a request
        // with no valid key, the gate has been bypassed.
        Response response = given(getExternalApiSpecNoKey())
                .header("X-User-Id", "000000000000000000000000")
                .header("X-API-Key-Id", "ak_0123456789abcdef")
                .get(PROBE_ENDPOINT);

        assertThat(response.getStatusCode())
                .as("Gateway-injected identity headers must not authenticate a request on their own")
                .isEqualTo(401);
    }

    @Tag("feature")
    @Tag("read")
    @Order(7)
    @Test
    @DisplayName("Rate limit headers are present and consistent")
    public void testRateLimitHeadersArePresent() {
        Response response = given(getExternalApiSpec()).get(PROBE_ENDPOINT);
        assertThat(response.getStatusCode()).as("Probe request should succeed").isEqualTo(200);

        int limitMinute = header(response, "X-RateLimit-Limit-Minute");
        int remainingMinute = header(response, "X-RateLimit-Remaining-Minute");
        int limitHour = header(response, "X-RateLimit-Limit-Hour");
        int limitDay = header(response, "X-RateLimit-Limit-Day");

        assertThat(limitMinute).as("Per-minute limit should be advertised").isPositive();
        assertThat(remainingMinute).as("Remaining should never exceed the limit").isLessThanOrEqualTo(limitMinute);
        assertThat(remainingMinute).as("Remaining should not be negative").isGreaterThanOrEqualTo(0);
        assertThat(limitHour).as("Hourly limit should be at least the per-minute limit")
                .isGreaterThanOrEqualTo(limitMinute);
        assertThat(limitDay).as("Daily limit should be at least the hourly limit")
                .isGreaterThanOrEqualTo(limitHour);

        log.info("Rate limit for key {}: {}/min, {}/hour, {}/day",
                ExternalApiConfig.maskedKey(), limitMinute, limitHour, limitDay);
    }

    private static ExternalErrorResponse attemptWithKey(String key, int expectedStatus) {
        return given(getExternalApiSpec(key))
                .get(PROBE_ENDPOINT)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    private static int header(Response response, String name) {
        String value = response.getHeader(name);
        assertThat(value).as("Response should carry the %s header", name).isNotNull();
        return Integer.parseInt(value.trim());
    }
}
