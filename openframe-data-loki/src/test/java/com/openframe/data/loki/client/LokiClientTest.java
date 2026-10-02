package com.openframe.data.loki.client;

import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
import java.net.URI;
import java.net.URLDecoder;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.headerDoesNotExist;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class LokiClientTest {

    private static final String EMPTY_RESPONSE =
            "{\"status\":\"success\",\"data\":{\"resultType\":\"streams\",\"result\":[]}}";

    private MockRestServiceServer server;
    private LokiClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://loki.test");
        server = MockRestServiceServer.bindTo(builder).build();
        client = new LokiClient(builder.build());
    }

    @Test
    void declaresTheActorSoTheSchedulerGivesTheCallerItsOwnSubQueue() {
        server.expect(requestTo(startsWith("http://loki.test/loki/api/v1/query_range")))
                .andExpect(header(LokiHttpApi.ACTOR_HEADER, "acme.openframe.ai"))
                .andRespond(withSuccess(EMPTY_RESPONSE, MediaType.APPLICATION_JSON));

        client.queryRange("{job=\"x\"}", 0, 1, 1, LokiDirection.BACKWARD, "acme.openframe.ai");
        server.verify();
    }

    @Test
    void sendsNoActorHeaderWhenNoneIsGiven() {
        // An empty header would make every anonymous caller share one named sub-queue instead of none
        server.expect(requestTo(startsWith("http://loki.test/loki/api/v1/query_range")))
                .andExpect(headerDoesNotExist(LokiHttpApi.ACTOR_HEADER))
                .andRespond(withSuccess(EMPTY_RESPONSE, MediaType.APPLICATION_JSON));

        client.queryRange("{job=\"x\"}", 0, 1, 1, LokiDirection.BACKWARD);
        server.verify();
    }

    @Test
    void capsTheBytesOneQueryMayReadWhenConfigured() {
        useByteCap("5GB");
        server.expect(requestTo(startsWith("http://loki.test/loki/api/v1/query_range")))
                .andExpect(header(LokiHttpApi.QUERY_LIMITS_HEADER, "{\"maxQueryBytesRead\":\"5GB\"}"))
                .andRespond(withSuccess(EMPTY_RESPONSE, MediaType.APPLICATION_JSON));

        client.queryRange("{job=\"x\"}", 0, 1, 1, LokiDirection.BACKWARD);
        server.verify();
    }

    @Test
    @DisplayName("no cap configured sends no header, so Loki's own limits apply unchanged")
    void sendsNoLimitsHeaderWhenNoCapIsConfigured() {
        server.expect(requestTo(startsWith("http://loki.test/loki/api/v1/query_range")))
                .andExpect(headerDoesNotExist(LokiHttpApi.QUERY_LIMITS_HEADER))
                .andRespond(withSuccess(EMPTY_RESPONSE, MediaType.APPLICATION_JSON));

        client.queryRange("{job=\"x\"}", 0, 1, 1, LokiDirection.BACKWARD);
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(ints = {400, 499})
    void queryRange_lokiAnswersAClientError_throwsRejectedWithStatusAndReason(int status) {
        server.expect(requestTo(startsWith("http://loki.test/")))
                .andRespond(withStatus(HttpStatusCode.valueOf(status)).body("the query would read too many bytes"));

        assertThatThrownBy(() -> client.queryRange("{job=\"x\"}", 0, 1, 1, LokiDirection.BACKWARD))
                .isExactlyInstanceOf(LokiQueryRejectedException.class)
                .hasMessage("Loki query failed with HTTP " + status + ": the query would read too many bytes")
                .hasCauseInstanceOf(RestClientResponseException.class);
    }

    @Test
    void queryRange_lokiAnswersAServerError_throwsPlainQueryFailureWithStatusAndReason() {
        server.expect(requestTo(startsWith("http://loki.test/")))
                .andRespond(withStatus(HttpStatusCode.valueOf(500)).body("ingester unavailable"));

        assertThatThrownBy(() -> client.queryRange("{job=\"x\"}", 0, 1, 1, LokiDirection.BACKWARD))
                .isExactlyInstanceOf(LokiQueryException.class)
                .hasMessage("Loki query failed with HTTP 500: ingester unavailable")
                .hasCauseInstanceOf(RestClientResponseException.class);
    }

    @Test
    void queryRange_errorBodyOf501Chars_keepsTheFirst500() {
        server.expect(requestTo(startsWith("http://loki.test/")))
                .andRespond(withStatus(HttpStatusCode.valueOf(400)).body("a".repeat(500) + "b"));

        assertThatThrownBy(() -> client.queryRange("{job=\"x\"}", 0, 1, 1, LokiDirection.BACKWARD))
                .hasMessage("Loki query failed with HTTP 400: " + "a".repeat(500) + "...");
    }

    @Test
    void sendsQueryRangeParametersEncoded() {
        // '+' would reach Loki as a space if left unencoded
        String query = "{job=\"agent-logs\"} |~ \"(?i)a+b\" | machine_id=\"m-1\"";
        server.expect(requestTo(startsWith("http://loki.test/loki/api/v1/query_range?")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(request -> assertThat(queryParams(request.getURI()))
                        .containsEntry("query", query)
                        .containsEntry("start", "100")
                        .containsEntry("end", "200")
                        .containsEntry("limit", "5")
                        .containsEntry("direction", "backward"))
                .andRespond(withSuccess(EMPTY_RESPONSE, MediaType.APPLICATION_JSON));

        assertThat(client.queryRange(query, 100, 200, 5, LokiDirection.BACKWARD)).isEmpty();
        server.verify();
    }

    @Test
    void mergesStreamsNewestFirstForBackwardQueries() {
        server.expect(requestTo(startsWith("http://loki.test/loki/api/v1/query_range")))
                .andRespond(withSuccess("""
                        {"status":"success","data":{"resultType":"streams","result":[
                          {"stream":{"level":"INFO","machine_id":"m-1"},"values":[["300","c"],["100","a"]]},
                          {"stream":{"level":"ERROR","machine_id":"m-1"},"values":[["200","b"]]}
                        ],"stats":{}}}
                        """, MediaType.APPLICATION_JSON));

        List<LokiLogEntry> entries = client.queryRange("{job=\"x\"}", 0, 400, 10, LokiDirection.BACKWARD);

        assertThat(entries).extracting(LokiLogEntry::line).containsExactly("c", "b", "a");
        assertThat(entries.get(1).labels()).containsEntry("level", "ERROR");
        assertThat(entries.get(0).timestamp().getNano()).isEqualTo(300);
    }

    @Test
    void queryRange_connectionFails_throwsQueryFailureWithTheCause() {
        server.expect(requestTo(startsWith("http://loki.test/")))
                .andRespond(withException(new IOException("connection refused")));

        assertThatThrownBy(() -> client.queryRange("{job=\"x\"}", 0, 1, 1, LokiDirection.BACKWARD))
                .isExactlyInstanceOf(LokiQueryException.class)
                .hasMessageStartingWith("Loki query failed: ")
                .hasMessageEndingWith("connection refused")
                .hasCauseInstanceOf(ResourceAccessException.class);
    }

    @Test
    void queryRange_resultIsNotLogStreams_throwsQueryFailureNamingTheType() {
        server.expect(requestTo(startsWith("http://loki.test/")))
                .andRespond(withSuccess("{\"status\":\"success\",\"data\":{\"resultType\":\"matrix\",\"result\":[]}}",
                        MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.queryRange("{job=\"x\"}", 0, 1, 1, LokiDirection.BACKWARD))
                .isExactlyInstanceOf(LokiQueryException.class)
                .hasMessage("Expected a log query result, got: matrix");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"status\":\"success\"}",
            "{\"status\":\"success\",\"data\":{\"resultType\":\"streams\"}}"})
    void queryRange_responseWithoutResult_returnsNoEntries(String response) {
        server.expect(requestTo(startsWith("http://loki.test/")))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));

        assertThat(client.queryRange("{job=\"x\"}", 0, 1, 1, LokiDirection.BACKWARD)).isEmpty();
    }

    @Test
    void queryRange_forwardDirection_asksForwardAndReturnsOldestFirst() {
        server.expect(requestTo(startsWith("http://loki.test/loki/api/v1/query_range")))
                .andExpect(request -> assertThat(queryParams(request.getURI())).containsEntry("direction", "forward"))
                .andRespond(withSuccess("""
                        {"status":"success","data":{"resultType":"streams","result":[
                          {"stream":{"level":"INFO"},"values":[["300","c"],["100","a"]]},
                          {"stream":{"level":"ERROR"},"values":[["200","b"]]}
                        ]}}
                        """, MediaType.APPLICATION_JSON));

        List<LokiLogEntry> entries = client.queryRange("{job=\"x\"}", 0, 400, 10, LokiDirection.FORWARD);

        assertThat(entries).extracting(LokiLogEntry::line).containsExactly("a", "b", "c");
    }

    @Test
    void queryRange_entriesShareATimestamp_ordersThemByLabelsThenLine() {
        server.expect(requestTo(startsWith("http://loki.test/")))
                .andRespond(withSuccess("""
                        {"status":"success","data":{"resultType":"streams","result":[
                          {"stream":{"level":"INFO"},"values":[["100","z"],["100","y"]]},
                          {"stream":{"level":"ERROR"},"values":[["100","x"]]}
                        ]}}
                        """, MediaType.APPLICATION_JSON));

        List<LokiLogEntry> entries = client.queryRange("{job=\"x\"}", 0, 400, 10, LokiDirection.BACKWARD);

        assertThat(entries).extracting(LokiLogEntry::line).containsExactly("x", "y", "z");
    }

    @Test
    void queryRange_streamWithoutValues_skipsIt() {
        server.expect(requestTo(startsWith("http://loki.test/")))
                .andRespond(withSuccess("""
                        {"status":"success","data":{"resultType":"streams","result":[
                          {"stream":{"level":"INFO"}},
                          {"stream":{"level":"ERROR"},"values":[["100","kept"]]}
                        ]}}
                        """, MediaType.APPLICATION_JSON));

        List<LokiLogEntry> entries = client.queryRange("{job=\"x\"}", 0, 400, 10, LokiDirection.BACKWARD);

        assertThat(entries).containsExactly(new LokiLogEntry(100, "kept", Map.of("level", "ERROR")));
    }

    @Test
    void queryRange_streamWithoutLabels_returnsItsEntriesWithNoLabels() {
        server.expect(requestTo(startsWith("http://loki.test/")))
                .andRespond(withSuccess("""
                        {"status":"success","data":{"resultType":"streams","result":[
                          {"values":[["100","kept"]]}
                        ]}}
                        """, MediaType.APPLICATION_JSON));

        List<LokiLogEntry> entries = client.queryRange("{job=\"x\"}", 0, 400, 10, LokiDirection.BACKWARD);

        assertThat(entries).containsExactly(new LokiLogEntry(100, "kept", Map.of()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"[\"200\"]", "null"})
    void queryRange_valueWithoutALine_skipsIt(String incompleteValue) {
        server.expect(requestTo(startsWith("http://loki.test/")))
                .andRespond(withSuccess("""
                        {"status":"success","data":{"resultType":"streams","result":[
                          {"stream":{"level":"INFO"},"values":[["100","kept"],%s]}
                        ]}}
                        """.formatted(incompleteValue), MediaType.APPLICATION_JSON));

        List<LokiLogEntry> entries = client.queryRange("{job=\"x\"}", 0, 400, 10, LokiDirection.BACKWARD);

        assertThat(entries).containsExactly(new LokiLogEntry(100, "kept", Map.of("level", "INFO")));
    }

    @Test
    void queryRange_byteCapWithSpacesAround_sendsItTrimmed() {
        useByteCap(" 5GB ");
        server.expect(requestTo(startsWith("http://loki.test/loki/api/v1/query_range")))
                .andExpect(header("X-Loki-Query-Limits", "{\"maxQueryBytesRead\":\"5GB\"}"))
                .andRespond(withSuccess(EMPTY_RESPONSE, MediaType.APPLICATION_JSON));

        client.queryRange("{job=\"x\"}", 0, 1, 1, LokiDirection.BACKWARD);

        server.verify();
    }

    @Test
    void queryRange_blankByteCap_sendsNoLimitsHeader() {
        useByteCap(" ");
        server.expect(requestTo(startsWith("http://loki.test/loki/api/v1/query_range")))
                .andExpect(headerDoesNotExist("X-Loki-Query-Limits"))
                .andRespond(withSuccess(EMPTY_RESPONSE, MediaType.APPLICATION_JSON));

        client.queryRange("{job=\"x\"}", 0, 1, 1, LokiDirection.BACKWARD);

        server.verify();
    }

    private void useByteCap(String byteCap) {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://loki.test");
        server = MockRestServiceServer.bindTo(builder).build();
        client = new LokiClient(builder.build(), byteCap);
    }

    private static Map<String, String> queryParams(URI uri) {
        Map<String, String> params = new HashMap<>();
        for (String pair : uri.getRawQuery().split("&")) {
            int separator = pair.indexOf('=');
            params.put(URLDecoder.decode(pair.substring(0, separator), UTF_8),
                    URLDecoder.decode(pair.substring(separator + 1), UTF_8));
        }
        return params;
    }
}
