package com.openframe.data.loki.client;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.io.IOException;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withNoContent;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

class LokiClientPushTest {

    private static final String PUSH_URL = "http://loki.test/loki/api/v1/push";
    private static final Map<String, String> LABELS =
            Map.of("job", "tool-events", "tenant_id", "tenant-a", "tool_type", "FLEET");
    private static final Map<String, String> METADATA = Map.of("tool_event_id", "evt-1", "event_type", "LOGIN");
    private static final long TIMESTAMP_NANOS = 1_700_000_000_123_000_000L;
    private static final String LINE = "{\"toolEventId\":\"evt-1\"}";

    private MockRestServiceServer server;
    private LokiClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://loki.test");
        server = MockRestServiceServer.bindTo(builder).build();
        client = new LokiClient(builder.build());
    }

    @Test
    void push_oneEntry_postsOneStreamAsJsonToThePushEndpoint() {
        server.expect(requestTo(PUSH_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(content().json("""
                        {"streams":[{
                          "stream":{"job":"tool-events","tenant_id":"tenant-a","tool_type":"FLEET"},
                          "values":[["1700000000123000000","{\\"toolEventId\\":\\"evt-1\\"}",
                                     {"tool_event_id":"evt-1","event_type":"LOGIN"}]]
                        }]}
                        """, true))
                .andRespond(withNoContent());

        client.push(LABELS, TIMESTAMP_NANOS, LINE, METADATA);

        server.verify();
    }

    @Test
    void push_lokiAnswersBadRequest_throwsRejectedWithStatusAndReason() {
        server.expect(requestTo(PUSH_URL))
                .andRespond(withStatus(HttpStatusCode.valueOf(400)).body("entry too far behind"));

        assertThatThrownBy(() -> client.push(LABELS, TIMESTAMP_NANOS, LINE, METADATA))
                .isExactlyInstanceOf(LokiPushRejectedException.class)
                .hasMessage("Loki push failed with HTTP 400: entry too far behind")
                .hasCauseInstanceOf(RestClientResponseException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {401, 403, 404, 408, 413, 428, 429, 430, 499, 500, 502, 503, 504})
    void push_anyErrorAnswerOtherThanBadRequest_throwsRetryableFailureWithStatusAndReason(int status) {
        server.expect(requestTo(PUSH_URL))
                .andRespond(withStatus(HttpStatusCode.valueOf(status)).body("ingester not ready"));

        assertThatThrownBy(() -> client.push(LABELS, TIMESTAMP_NANOS, LINE, METADATA))
                .isExactlyInstanceOf(LokiPushException.class)
                .hasMessage("Loki push failed with HTTP " + status + ": ingester not ready")
                .hasCauseInstanceOf(RestClientResponseException.class);
    }

    @Test
    void push_connectionFails_throwsRetryableFailureWithTheCause() {
        server.expect(requestTo(PUSH_URL))
                .andRespond(withException(new IOException("connection refused")));

        assertThatThrownBy(() -> client.push(LABELS, TIMESTAMP_NANOS, LINE, METADATA))
                .isExactlyInstanceOf(LokiPushException.class)
                .hasMessage("Loki push failed: I/O error on POST request for \"" + PUSH_URL + "\": connection refused")
                .hasCauseInstanceOf(ResourceAccessException.class);
    }

    @Test
    void push_errorBodyOf500Chars_keepsItWhole() {
        String body = "a".repeat(499) + "b";
        server.expect(requestTo(PUSH_URL))
                .andRespond(withStatus(HttpStatusCode.valueOf(400)).body(body));

        assertThatThrownBy(() -> client.push(LABELS, TIMESTAMP_NANOS, LINE, METADATA))
                .hasMessage("Loki push failed with HTTP 400: " + body);
    }

    @Test
    void push_errorBodyOf501Chars_keepsTheFirst500() {
        server.expect(requestTo(PUSH_URL))
                .andRespond(withStatus(HttpStatusCode.valueOf(400)).body("a".repeat(500) + "b"));

        assertThatThrownBy(() -> client.push(LABELS, TIMESTAMP_NANOS, LINE, METADATA))
                .hasMessage("Loki push failed with HTTP 400: " + "a".repeat(500) + "...");
    }

    @Test
    void push_errorWithoutBody_reportsTheStatusAlone() {
        server.expect(requestTo(PUSH_URL))
                .andRespond(withStatus(HttpStatusCode.valueOf(503)));

        assertThatThrownBy(() -> client.push(LABELS, TIMESTAMP_NANOS, LINE, METADATA))
                .hasMessage("Loki push failed with HTTP 503: ");
    }
}
