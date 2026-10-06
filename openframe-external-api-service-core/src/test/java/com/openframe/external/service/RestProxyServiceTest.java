package com.openframe.external.service;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.apikey.APIKeyType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.ToolUrlService;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static com.openframe.core.constants.HttpHeaders.ACCEPT;
import static com.openframe.core.constants.HttpHeaders.ACCEPT_CHARSET;
import static com.openframe.core.constants.HttpHeaders.ACCEPT_LANGUAGE;
import static com.openframe.core.constants.HttpHeaders.APPLICATION_JSON;
import static com.openframe.core.constants.HttpHeaders.AUTHORIZATION;
import static com.openframe.core.constants.HttpHeaders.CONTENT_TYPE;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RestProxyServiceTest {

    private static final String KEY = "s3cr3t-api-key";
    private static final String MASKED = "****";
    private static final String TOOL_ID = "tactical-rmm";

    @Mock
    private IntegratedToolRepository toolRepository;

    @Mock
    private ProxyUrlResolver proxyUrlResolver;

    @Mock
    private ToolUrlService toolUrlService;

    @InjectMocks
    private RestProxyService service;

    private HttpServer upstream;
    private final AtomicReference<ReceivedRequest> received = new AtomicReference<>();

    @AfterEach
    void stopUpstream() {
        if (upstream != null) {
            upstream.stop(0);
        }
    }

    @Test
    void bearerTokenGoesToAuthorizationAndIsMaskedThere() {
        IntegratedTool tool = tool(APIKeyType.BEARER_TOKEN, null);

        Map<String, String> headers = service.buildApiRequestHeaders(tool);
        Map<String, String> masked = service.maskCredential(headers, tool.getCredentials());

        assertEquals("Bearer " + KEY, headers.get(AUTHORIZATION));
        assertEquals(MASKED, masked.get(AUTHORIZATION));
        assertBoilerplateUntouched(masked);
        assertEquals(headers.size(), masked.size());
    }

    @Test
    void headerKeyGoesUnderItsConfiguredNameAndIsMaskedThere() {
        IntegratedTool tool = tool(APIKeyType.HEADER, "X-Auth-Token");

        Map<String, String> headers = service.buildApiRequestHeaders(tool);
        Map<String, String> masked = service.maskCredential(headers, tool.getCredentials());

        assertEquals(KEY, headers.get("X-Auth-Token"));
        assertEquals(MASKED, masked.get("X-Auth-Token"));
        assertFalse(masked.containsKey(AUTHORIZATION));
        assertBoilerplateUntouched(masked);
        assertEquals(headers.size(), masked.size());
    }

    @Test
    void maskingIsByHeaderNameNotByValue() {
        IntegratedTool tool = tool(APIKeyType.BEARER_TOKEN, null);
        Map<String, String> headers = Map.of(AUTHORIZATION, "Basic dXNlcjpzM2NyM3Q=", ACCEPT, APPLICATION_JSON);

        Map<String, String> masked = service.maskCredential(headers, tool.getCredentials());

        assertEquals(MASKED, masked.get(AUTHORIZATION));
        assertEquals(APPLICATION_JSON, masked.get(ACCEPT));
    }

    @Test
    void headerNameMatchIgnoresCase() {
        IntegratedTool tool = tool(APIKeyType.HEADER, "x-api-key");
        Map<String, String> headers = Map.of("X-API-KEY", KEY);

        Map<String, String> masked = service.maskCredential(headers, tool.getCredentials());

        assertEquals(MASKED, masked.get("X-API-KEY"));
    }

    @Test
    void noCredentialsAddsNothingAndMasksNothing() {
        IntegratedTool tool = IntegratedTool.builder().build();

        Map<String, String> headers = service.buildApiRequestHeaders(tool);
        Map<String, String> masked = service.maskCredential(headers, tool.getCredentials());

        assertEquals(4, headers.size());
        assertFalse(headers.containsKey(AUTHORIZATION));
        assertSame(headers, masked);
    }

    @Test
    void noneTypeAddsNothingAndMasksNothing() {
        IntegratedTool tool = tool(APIKeyType.NONE, null);

        Map<String, String> headers = service.buildApiRequestHeaders(tool);
        Map<String, String> masked = service.maskCredential(headers, tool.getCredentials());

        assertEquals(4, headers.size());
        assertSame(headers, masked);
    }

    @Test
    void unknownToolIs404AndNothingIsResolved() {
        when(toolRepository.findByKey("ghost")).thenReturn(Optional.empty());

        ResponseEntity<String> response = service.proxyApiRequest("ghost", request("GET", "/tools/ghost/api", null), null);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertEquals("Tool not found: ghost", response.getBody());
        verifyNoInteractions(toolUrlService, proxyUrlResolver);
    }

    @Test
    void disabledToolIs400AndNothingIsResolved() {
        IntegratedTool tool = IntegratedTool.builder().key(TOOL_ID).name("Tactical RMM").enabled(false).build();
        when(toolRepository.findByKey(TOOL_ID)).thenReturn(Optional.of(tool));

        ResponseEntity<String> response = service.proxyApiRequest(TOOL_ID, request("GET", "/tools/tactical-rmm/api", null), null);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Tool Tactical RMM is not enabled", response.getBody());
        verifyNoInteractions(toolUrlService, proxyUrlResolver);
    }

    @Test
    void toolWithoutApiUrlIs400AndNothingIsResolved() {
        IntegratedTool tool = enabledTool(null);
        when(toolRepository.findByKey(TOOL_ID)).thenReturn(Optional.of(tool));
        when(toolUrlService.getUrlByToolType(tool, ToolUrlType.API)).thenReturn(Optional.empty());

        ResponseEntity<String> response = service.proxyApiRequest(TOOL_ID, request("GET", "/tools/tactical-rmm/api", null), null);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Tool URL not found for tool: tactical-rmm", response.getBody());
        verifyNoInteractions(proxyUrlResolver);
    }

    @Test
    void malformedQueryStringIs400InvalidUri() {
        when(toolRepository.findByKey(TOOL_ID)).thenReturn(Optional.of(enabledTool(null)));

        ResponseEntity<String> response = service.proxyApiRequest(TOOL_ID, request("GET", "/tools/tactical-rmm/api", "q=a b"), null);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody().startsWith("Invalid URI: "), response.getBody());
        verifyNoInteractions(toolUrlService, proxyUrlResolver);
    }

    @Test
    void resolverGetsApiUrlPortOriginalUriWithQueryAndToolsPrefix() {
        stubToolWithApiUrl(enabledTool(null), new ToolUrl("http://rmm-api", "8000", ToolUrlType.API));
        when(proxyUrlResolver.resolvePreservingEncoding(any(), any(), any(), any(), any())).thenThrow(new RuntimeException("Failed to resolve tool url"));

        service.proxyApiRequest(TOOL_ID, request("GET", "/tools/tactical-rmm/api/v1/agents", "status=online&page=2"), null);

        ArgumentCaptor<URI> originalUri = ArgumentCaptor.forClass(URI.class);
        verify(proxyUrlResolver).resolvePreservingEncoding(eq(TOOL_ID), eq("http://rmm-api"), eq("8000"), originalUri.capture(), eq("/tools"));
        assertEquals("/tools/tactical-rmm/api/v1/agents", originalUri.getValue().getPath());
        assertEquals("status=online&page=2", originalUri.getValue().getRawQuery());
    }

    @Test
    void originalUriHasNoQueryWhenRequestHasNone() {
        stubToolWithApiUrl(enabledTool(null), new ToolUrl("http://rmm-api", "8000", ToolUrlType.API));
        when(proxyUrlResolver.resolvePreservingEncoding(any(), any(), any(), any(), any())).thenThrow(new RuntimeException("Failed to resolve tool url"));

        service.proxyApiRequest(TOOL_ID, request("GET", "/tools/tactical-rmm/api/v1/agents", null), null);

        ArgumentCaptor<URI> originalUri = ArgumentCaptor.forClass(URI.class);
        verify(proxyUrlResolver).resolvePreservingEncoding(eq(TOOL_ID), eq("http://rmm-api"), eq("8000"), originalUri.capture(), eq("/tools"));
        assertEquals("http://localhost/tools/tactical-rmm/api/v1/agents", originalUri.getValue().toString());
    }

    @Test
    void resolverFailureIs500WithItsMessage() {
        stubToolWithApiUrl(enabledTool(null), new ToolUrl("http://rmm-api", "8000", ToolUrlType.API));
        when(proxyUrlResolver.resolvePreservingEncoding(any(), any(), any(), any(), any())).thenThrow(new RuntimeException("Failed to resolve tool url"));

        ResponseEntity<String> response = service.proxyApiRequest(TOOL_ID, request("GET", "/tools/tactical-rmm/api", null), null);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals("Internal server error: Failed to resolve tool url", response.getBody());
    }

    @ParameterizedTest
    @ValueSource(strings = {"TRACE", "CONNECT", "BOGUS"})
    void unsupportedMethodIs500WithoutCallingTheTool(String method) {
        stubToolWithApiUrl(enabledTool(null), new ToolUrl("http://rmm-api", "8000", ToolUrlType.API));
        when(proxyUrlResolver.resolvePreservingEncoding(any(), any(), any(), any(), any())).thenReturn(URI.create("http://rmm-api:8000/api"));

        ResponseEntity<String> response = service.proxyApiRequest(TOOL_ID, request(method, "/tools/tactical-rmm/api", null), null);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals("Unexpected error: Unsupported HTTP method: " + method, response.getBody());
    }

    @Test
    void unsupportedTargetSchemeIs500ProxyError() {
        stubToolWithApiUrl(enabledTool(null), new ToolUrl("ftp://rmm-api", "21", ToolUrlType.API));
        when(proxyUrlResolver.resolvePreservingEncoding(any(), any(), any(), any(), any())).thenReturn(URI.create("ftp://127.0.0.1:21/api"));

        ResponseEntity<String> response = service.proxyApiRequest(TOOL_ID, request("GET", "/tools/tactical-rmm/api", null), null);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertTrue(response.getBody().startsWith("Proxy error: "), response.getBody());
    }

    @Test
    void getIsForwardedToTheApiUrlWithPrefixStrippedAndQueryKept() throws IOException {
        startUpstream(200, "{\"agents\":[]}");
        RestProxyService forwarding = forwardingService(enabledTool(null));

        ResponseEntity<String> response = forwarding.proxyApiRequest(TOOL_ID,
                request("GET", "/tools/tactical-rmm/api/v1/agents", "status=online&q=a%20b"), null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("{\"agents\":[]}", response.getBody());
        assertEquals("GET", received.get().method());
        assertEquals("/api/v1/agents?status=online&q=a%20b", received.get().uri());
        assertEquals("", received.get().body());
    }

    @Test
    void encodedReservedCharactersReachTheToolAsSent() throws IOException {
        startUpstream(200, "ok");
        RestProxyService forwarding = forwardingService(enabledTool(null));

        forwarding.proxyApiRequest(TOOL_ID,
                request("GET", "/tools/tactical-rmm/files/a%2Fb", "q=a%26b%3Dc&x=%2B1"), null);

        assertEquals("/files/a%2Fb?q=a%26b%3Dc&x=%2B1", received.get().uri());
    }

    @Test
    void toolRootIsForwardedAsSlash() throws IOException {
        startUpstream(200, "root");
        RestProxyService forwarding = forwardingService(enabledTool(null));

        ResponseEntity<String> response = forwarding.proxyApiRequest(TOOL_ID, request("GET", "/tools/tactical-rmm", null), null);

        assertEquals("root", response.getBody());
        assertEquals("/", received.get().uri());
    }

    @ParameterizedTest
    @ValueSource(strings = {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"})
    void everySupportedMethodIsForwardedAsIs(String method) throws IOException {
        startUpstream(200, "ok");
        RestProxyService forwarding = forwardingService(enabledTool(null));

        ResponseEntity<String> response = forwarding.proxyApiRequest(TOOL_ID,
                request(method, "/tools/tactical-rmm/api/v1/agents/7", null), null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(method, received.get().method());
        assertEquals("/api/v1/agents/7", received.get().uri());
    }

    @Test
    void lowercaseMethodIsNormalised() throws IOException {
        startUpstream(200, "ok");
        RestProxyService forwarding = forwardingService(enabledTool(null));

        forwarding.proxyApiRequest(TOOL_ID, request("delete", "/tools/tactical-rmm/api/v1/agents/7", null), null);

        assertEquals("DELETE", received.get().method());
    }

    @Test
    void bodyIsForwardedAsJsonAndUpstreamStatusIsKept() throws IOException {
        startUpstream(201, "{\"id\":42}");
        RestProxyService forwarding = forwardingService(enabledTool(null));
        String body = "{\"hostname\":\"host-7\",\"note\":\"caf\u00e9\"}";

        ResponseEntity<String> response = forwarding.proxyApiRequest(TOOL_ID,
                request("POST", "/tools/tactical-rmm/api/v1/agents", null), body);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals("{\"id\":42}", response.getBody());
        assertEquals("POST", received.get().method());
        assertEquals(body, received.get().body());
        assertEquals(APPLICATION_JSON, received.get().headers().getFirst(CONTENT_TYPE));
    }

    @Test
    void emptyBodyIsNotForwarded() throws IOException {
        startUpstream(200, "ok");
        RestProxyService forwarding = forwardingService(enabledTool(null));

        forwarding.proxyApiRequest(TOOL_ID, request("POST", "/tools/tactical-rmm/api/v1/agents", null), "");

        assertEquals("", received.get().body());
    }

    @Test
    void bearerCredentialAndBoilerplateHeadersAreSentUpstream() throws IOException {
        startUpstream(200, "ok");
        RestProxyService forwarding = forwardingService(enabledTool(tool(APIKeyType.BEARER_TOKEN, null).getCredentials()));

        forwarding.proxyApiRequest(TOOL_ID, request("GET", "/tools/tactical-rmm/api", null), null);

        Headers headers = received.get().headers();
        assertEquals("Bearer " + KEY, headers.getFirst(AUTHORIZATION));
        assertEquals(APPLICATION_JSON, headers.getFirst(ACCEPT));
        assertEquals("UTF-8", headers.getFirst(ACCEPT_CHARSET));
        assertEquals("en-US,en;q=0.9", headers.getFirst(ACCEPT_LANGUAGE));
        assertEquals(APPLICATION_JSON, headers.getFirst(CONTENT_TYPE));
    }

    @Test
    void headerCredentialIsSentUpstreamUnderItsConfiguredName() throws IOException {
        startUpstream(200, "ok");
        RestProxyService forwarding = forwardingService(enabledTool(tool(APIKeyType.HEADER, "X-Auth-Token").getCredentials()));

        forwarding.proxyApiRequest(TOOL_ID, request("GET", "/tools/tactical-rmm/api", null), null);

        assertEquals(KEY, received.get().headers().getFirst("X-Auth-Token"));
        assertNull(received.get().headers().getFirst(AUTHORIZATION));
    }

    @Test
    void callerHeadersAreNotForwardedUpstream() throws IOException {
        startUpstream(200, "ok");
        RestProxyService forwarding = forwardingService(enabledTool(null));
        MockHttpServletRequest request = request("GET", "/tools/tactical-rmm/api", null);
        request.addHeader("X-API-Key-Id", "ak_test");
        request.addHeader(AUTHORIZATION, "Bearer caller-token");

        forwarding.proxyApiRequest(TOOL_ID, request, null);

        assertNull(received.get().headers().getFirst("X-API-Key-Id"));
        assertNull(received.get().headers().getFirst(AUTHORIZATION));
    }

    @ParameterizedTest
    @ValueSource(ints = {400, 401, 404, 500, 503})
    void upstreamErrorStatusAndBodyArePassedBack(int status) throws IOException {
        startUpstream(status, "{\"detail\":\"upstream says no\"}");
        RestProxyService forwarding = forwardingService(enabledTool(null));

        ResponseEntity<String> response = forwarding.proxyApiRequest(TOOL_ID, request("GET", "/tools/tactical-rmm/api", null), null);

        assertEquals(status, response.getStatusCode().value());
        assertEquals("{\"detail\":\"upstream says no\"}", response.getBody());
    }

    @Test
    void upstreamResponseWithoutBodyBecomesEmptyString() throws IOException {
        startUpstream(204, null);
        RestProxyService forwarding = forwardingService(enabledTool(null));

        ResponseEntity<String> response = forwarding.proxyApiRequest(TOOL_ID,
                request("DELETE", "/tools/tactical-rmm/api/v1/agents/7", null), null);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        assertEquals("", response.getBody());
    }

    @Test
    void connectionDroppedByTheToolIs500ProxyError() throws IOException {
        startUpstream(exchange -> exchange.close());
        RestProxyService forwarding = forwardingService(enabledTool(null));

        ResponseEntity<String> response = forwarding.proxyApiRequest(TOOL_ID,
                request("POST", "/tools/tactical-rmm/api/v1/agents", null), null);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertTrue(response.getBody().startsWith("Proxy error: "), response.getBody());
    }

    /** Service wired with the real URL resolver and URL lookup, pointing the tool's API url at the loopback upstream. */
    private RestProxyService forwardingService(IntegratedTool tool) {
        String port = String.valueOf(upstream.getAddress().getPort());
        tool.setToolUrls(List.of(
                new ToolUrl("http://dashboard.invalid", "1", ToolUrlType.DASHBOARD),
                new ToolUrl("http://127.0.0.1", port, ToolUrlType.API)));
        when(toolRepository.findByKey(TOOL_ID)).thenReturn(Optional.of(tool));
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("test");
        return new RestProxyService(toolRepository, new ProxyUrlResolver(environment), new ToolUrlService());
    }

    private void startUpstream(int status, String responseBody) throws IOException {
        startUpstream(exchange -> {
            received.set(new ReceivedRequest(
                    exchange.getRequestMethod(),
                    exchange.getRequestURI().toString(),
                    exchange.getRequestHeaders(),
                    new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
            if (responseBody == null) {
                exchange.sendResponseHeaders(status, -1);
            } else {
                byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(status, bytes.length);
                exchange.getResponseBody().write(bytes);
            }
            exchange.close();
        });
    }

    private void startUpstream(HttpHandler handler) throws IOException {
        upstream = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        upstream.createContext("/", handler);
        upstream.start();
    }

    private void stubToolWithApiUrl(IntegratedTool tool, ToolUrl apiUrl) {
        when(toolRepository.findByKey(TOOL_ID)).thenReturn(Optional.of(tool));
        when(toolUrlService.getUrlByToolType(tool, ToolUrlType.API)).thenReturn(Optional.of(apiUrl));
    }

    private static IntegratedTool enabledTool(ToolCredentials credentials) {
        return IntegratedTool.builder().key(TOOL_ID).name("Tactical RMM").enabled(true).credentials(credentials).build();
    }

    private static MockHttpServletRequest request(String method, String uri, String queryString) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setQueryString(queryString);
        return request;
    }

    private static IntegratedTool tool(APIKeyType type, String keyName) {
        ToolApiKey apiKey = new ToolApiKey();
        apiKey.setType(type);
        apiKey.setKey(KEY);
        apiKey.setKeyName(keyName);
        ToolCredentials credentials = new ToolCredentials();
        credentials.setApiKey(apiKey);
        return IntegratedTool.builder().credentials(credentials).build();
    }

    private static void assertBoilerplateUntouched(Map<String, String> headers) {
        assertEquals("UTF-8", headers.get(ACCEPT_CHARSET));
        assertEquals("en-US,en;q=0.9", headers.get(ACCEPT_LANGUAGE));
        assertEquals(APPLICATION_JSON, headers.get(CONTENT_TYPE));
        assertEquals(APPLICATION_JSON, headers.get(ACCEPT));
    }

    private record ReceivedRequest(String method, String uri, Headers headers, String body) {
    }
}
