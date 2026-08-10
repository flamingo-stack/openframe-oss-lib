package com.openframe.gateway.service;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.reactive.repository.tool.ReactiveIntegratedToolRepository;
import com.openframe.gateway.config.prop.FleetMultiTenancyProperties;
import com.openframe.gateway.upstream.ToolUpstreamResolver;
import com.openframe.gateway.upstream.ToolUpstreamResolverRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

class RestProxyServiceResponseRelayTest {

    private static final String FLEET = "fleetmdm-server";
    private static final String CAPABILITIES = "X-Fleet-Capabilities";

    private ReactiveIntegratedToolRepository toolRepository;
    private RestProxyService service;

    @BeforeEach
    void setUp() {
        toolRepository = mock(ReactiveIntegratedToolRepository.class);

        ToolUpstreamResolver resolver = mock(ToolUpstreamResolver.class);
        when(resolver.resolveRest(any(), any(), any()))
                .thenReturn(URI.create("http://fleet:8080/api/fleet/orbit/ping"));
        ToolUpstreamResolverRegistry registry = mock(ToolUpstreamResolverRegistry.class);
        when(registry.resolve(FLEET)).thenReturn(resolver);

        FleetMultiTenancyProperties props = new FleetMultiTenancyProperties();
        props.setAllowedEndpoints(List.of("GET /api/{v}/fleet/hosts"));

        service = spy(new RestProxyService(
                toolRepository,
                registry,
                mock(ToolApiKeyHeadersResolver.class),
                new FleetEndpointAllowlist(props)));
    }

    private void upstreamResponds(ClientResponse response) {
        WebClient stub = WebClient.builder()
                .exchangeFunction(request -> Mono.just(response))
                .build();
        doReturn(stub).when(service).webClient(any());
    }

    private void toolExists(boolean enabled) {
        IntegratedTool tool = new IntegratedTool();
        tool.setName("Fleet");
        tool.setEnabled(enabled);
        when(toolRepository.findByKey(FLEET)).thenReturn(Mono.just(tool));
    }

    private ServerHttpRequest ping() {
        return MockServerHttpRequest
                .head("/tools/agent/" + FLEET + "/api/fleet/orbit/ping")
                .build();
    }

    private ResponseEntity<String> proxyPing() {
        ResponseEntity<String> response = service.proxyAgentRequest(FLEET, ping(), null).block();
        assertThat(response).as("proxy must always produce a response").isNotNull();
        return response;
    }

    @Test
    void relaysEmptyBodiedSuccessInsteadOfReportingToolNotFound() {
        toolExists(true);
        upstreamResponds(ClientResponse.create(HttpStatus.OK)
                .header(CAPABILITIES, "orbit_endpoints,token_rotation")
                .build());

        ResponseEntity<String> response = proxyPing();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNull();
        assertThat(response.getHeaders().getFirst(CAPABILITIES)).isEqualTo("orbit_endpoints,token_rotation");
    }

    @Test
    void relaysUpstreamErrorStatusAndBody() {
        toolExists(true);
        upstreamResponds(ClientResponse.create(HttpStatus.GONE)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .body("{\"error\":\"gone\"}")
                .build());

        ResponseEntity<String> response = proxyPing();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.GONE);
        assertThat(response.getBody()).isEqualTo("{\"error\":\"gone\"}");
    }

    @Test
    void relaysEmptyBodiedUpstreamError() {
        toolExists(true);
        upstreamResponds(ClientResponse.create(HttpStatus.UNAUTHORIZED).build());

        assertThat(proxyPing().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void relaysRedirectLocation() {
        toolExists(true);
        upstreamResponds(ClientResponse.create(HttpStatus.TEMPORARY_REDIRECT)
                .header(HttpHeaders.LOCATION, "https://storage.example/package.pkg")
                .build());

        ResponseEntity<String> response = proxyPing();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TEMPORARY_REDIRECT);
        assertThat(response.getHeaders().getFirst(HttpHeaders.LOCATION))
                .isEqualTo("https://storage.example/package.pkg");
    }

    @Test
    void relaysRetryAfterOnThrottledUpstream() {
        toolExists(true);
        upstreamResponds(ClientResponse.create(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, "120")
                .build());

        ResponseEntity<String> response = proxyPing();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(response.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("120");
    }

    @Test
    void doesNotLeakUpstreamCookiesOrCorsHeaders() {
        toolExists(true);
        upstreamResponds(ClientResponse.create(HttpStatus.OK)
                .header(HttpHeaders.SET_COOKIE, "session=upstream")
                .header(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "https://upstream.example")
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .body("{}")
                .build());

        HttpHeaders headers = proxyPing().getHeaders();

        assertThat(headers.containsKey(HttpHeaders.SET_COOKIE)).isFalse();
        assertThat(headers.containsKey(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN)).isFalse();
        assertThat(headers.getContentType()).isEqualTo(MediaType.APPLICATION_JSON);
    }

    @Test
    void stillReportsMissingTool() {
        when(toolRepository.findByKey(FLEET)).thenReturn(Mono.empty());

        ResponseEntity<String> response = proxyPing();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isEqualTo("Tool not found: " + FLEET);
    }

    @Test
    void reportsDisabledTool() {
        toolExists(false);

        assertThat(proxyPing().getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
