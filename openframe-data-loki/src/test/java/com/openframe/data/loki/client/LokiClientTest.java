package com.openframe.data.loki.client;

import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.net.URLDecoder;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
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
    void wrapsLokiErrorsWithStatusAndBody() {
        server.expect(requestTo(startsWith("http://loki.test/")))
                .andRespond(withBadRequest().body("parse error at line 1").contentType(MediaType.TEXT_PLAIN));

        assertThatThrownBy(() -> client.queryRange("{", 0, 1, 1, LokiDirection.BACKWARD))
                .isInstanceOf(LokiQueryException.class)
                .hasMessageContaining("HTTP 400")
                .hasMessageContaining("parse error");
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
