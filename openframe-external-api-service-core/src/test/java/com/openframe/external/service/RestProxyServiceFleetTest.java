package com.openframe.external.service;

import com.openframe.core.exception.BaseException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.core.exception.InternalException;
import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.apikey.APIKeyType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.ToolUrlService;
import com.openframe.external.config.FleetProxyProperties;
import com.openframe.external.config.ToolProxyHttpClientConfig;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpServer;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RestProxyServiceFleetTest {

    private static final String FLEET = "fleetmdm-server";
    private static final String TENANT_ID = "tenant-a";
    private static final String FLEET_TOKEN = "fleet-api-token";
    private static final String TENANT_HEADER = "X-Tenant-Id";
    private static final List<String> ALLOWED = List.of(
            "GET /api/{v}/fleet/hosts",
            "GET /api/{v}/fleet/hosts/{id:[0-9]+}",
            "GET /api/{v}/fleet/hosts/identifier/{identifier}",
            "GET /api/{v}/fleet/hosts/{id:[0-9]+}/software"
    );

    @Mock
    private IntegratedToolRepository toolRepository;

    @Mock
    private TenantIdProvider tenantIdProvider;

    private final AtomicReference<Received> received = new AtomicReference<>();
    private HttpServer upstream;

    @AfterEach
    void stopUpstream() {
        if (upstream != null) {
            upstream.stop(0);
        }
    }

    @Test
    void proxy_allowedFleetGet_forwardedWithTenantHeaderAndToolToken() throws IOException {
        // setup
        startUpstream(200, "{\"host\":{\"id\":42}}", null);
        stubFleetTool();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        RestProxyService service = service(true);

        // execution
        ResponseEntity<String> response = service.proxyApiRequest(FLEET, request("GET", "/tools/fleetmdm-server/api/v1/fleet/hosts/42"), null);

        // verifications
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("{\"host\":{\"id\":42}}");
        assertThat(received.get().uri()).isEqualTo("/api/v1/fleet/hosts/42");
        assertThat(received.get().headers().get(TENANT_HEADER)).containsExactly(TENANT_ID);
        assertThat(received.get().headers().getFirst("Authorization")).isEqualTo("Bearer " + FLEET_TOKEN);
    }

    @Test
    void proxy_allowedFleetGetWithQuery_queryForwardedUnchanged() throws IOException {
        // setup
        startUpstream(200, "{\"software\":[]}", null);
        stubFleetTool();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        RestProxyService service = service(true);
        MockHttpServletRequest request = request("GET", "/tools/fleetmdm-server/api/latest/fleet/hosts/42/software");
        request.setQueryString("page=1&per_page=100&vulnerable=true");

        // execution
        service.proxyApiRequest(FLEET, request, null);

        // verifications
        assertThat(received.get().uri()).isEqualTo("/api/latest/fleet/hosts/42/software?page=1&per_page=100&vulnerable=true");
    }

    @Test
    void proxy_offListFleetEndpoint_throws403WithoutToolLookupOrUpstreamCall() {
        // setup
        RestProxyService service = service(true);

        // execution
        Throwable thrown = catchThrowable(() -> service.proxyApiRequest(FLEET,
                request("POST", "/tools/fleetmdm-server/api/v1/fleet/hosts/42/refetch"), null));

        // verifications
        assertEndpointNotAllowed(thrown);
        verifyNoInteractions(toolRepository, tenantIdProvider);
    }

    @Test
    void proxy_listedWriteEndpoint_forwardedWithBodyAndTenantHeader() throws IOException {
        // setup
        startUpstream(200, "{\"policy\":{\"id\":7}}", null);
        stubFleetTool();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        RestProxyService service = service(true, List.of("GET /api/{v}/fleet/policies", "POST /api/{v}/fleet/policies"));
        String body = "{\"name\":\"disk encryption\",\"query\":\"select 1\"}";

        // execution
        ResponseEntity<String> response = service.proxyApiRequest(FLEET,
                request("POST", "/tools/fleetmdm-server/api/latest/fleet/policies"), body);

        // verifications
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(received.get().method()).isEqualTo("POST");
        assertThat(received.get().uri()).isEqualTo("/api/latest/fleet/policies");
        assertThat(received.get().body()).isEqualTo(body);
        assertThat(received.get().headers().get(TENANT_HEADER)).containsExactly(TENANT_ID);
    }

    @Test
    void proxy_writeOnPathListedOnlyForGet_throws403WithoutToolLookup() {
        // setup
        RestProxyService service = service(true, List.of("GET /api/{v}/fleet/policies"));

        // execution
        Throwable thrown = catchThrowable(() -> service.proxyApiRequest(FLEET,
                request("POST", "/tools/fleetmdm-server/api/v1/fleet/policies"), "{}"));

        // verifications
        assertEndpointNotAllowed(thrown);
        verifyNoInteractions(toolRepository, tenantIdProvider);
    }

    @Test
    void proxy_dotSegmentPath_throws403WithoutToolLookup() {
        // setup
        RestProxyService service = service(true);

        // execution
        Throwable thrown = catchThrowable(() -> service.proxyApiRequest(FLEET,
                request("GET", "/tools/fleetmdm-server/api/v1/fleet/hosts/%2e%2e/software"), null));

        // verifications
        assertEndpointNotAllowed(thrown);
        verifyNoInteractions(toolRepository);
    }

    @Test
    void proxy_hostsReportWithLabel_throws403WithoutToolLookup() {
        // setup
        RestProxyService service = service(true);
        MockHttpServletRequest request = request("GET", "/tools/fleetmdm-server/api/v1/fleet/hosts/report");
        request.setQueryString("format=csv&label_id=1");

        // execution
        Throwable thrown = catchThrowable(() -> service.proxyApiRequest(FLEET, request, null));

        // verifications
        assertEndpointNotAllowed(thrown);
        verifyNoInteractions(toolRepository);
    }

    @Test
    void proxy_toolIdEncodedInRawPath_throws403WithoutToolLookup() {
        // setup
        RestProxyService service = service(true);

        // execution
        Throwable thrown = catchThrowable(() -> service.proxyApiRequest(FLEET,
                request("GET", "/tools/fleetmdm%2Dserver/api/v1/fleet/queries"), null));

        // verifications
        assertEndpointNotAllowed(thrown);
        assertThat(thrown).hasMessageContaining("GET /tools/fleetmdm%2Dserver/api/v1/fleet/queries");
        verifyNoInteractions(toolRepository);
    }

    @Test
    void proxy_fleetToolRoot_throws403() {
        // setup
        RestProxyService service = service(true);

        // execution
        Throwable thrown = catchThrowable(() -> service.proxyApiRequest(FLEET, request("GET", "/tools/fleetmdm-server"), null));

        // verifications
        assertEndpointNotAllowed(thrown);
    }

    @Test
    void proxy_callerSuppliedTenantHeader_upstreamGetsOnlyProviderTenant() throws IOException {
        // setup
        startUpstream(200, "{\"hosts\":[]}", null);
        stubFleetTool();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        RestProxyService service = service(true);
        MockHttpServletRequest request = request("GET", "/tools/fleetmdm-server/api/v1/fleet/hosts");
        request.addHeader(TENANT_HEADER, "tenant-b");

        // execution
        service.proxyApiRequest(FLEET, request, null);

        // verifications
        assertThat(received.get().headers().get(TENANT_HEADER)).containsExactly(TENANT_ID);
    }

    @Test
    void proxy_blankTenant_throwsInternalWithoutUpstreamCall() throws IOException {
        // setup
        startUpstream(200, "{\"hosts\":[]}", null);
        when(tenantIdProvider.getTenantId()).thenReturn("");
        RestProxyService service = service(true);

        // execution
        Throwable thrown = catchThrowable(() -> service.proxyApiRequest(FLEET,
                request("GET", "/tools/fleetmdm-server/api/v1/fleet/hosts"), null));

        // verifications
        assertThat(thrown).isInstanceOf(InternalException.class);
        assertThat(received.get()).isNull();
    }

    @Test
    void proxy_fleetForeignHost404_passedBack() throws IOException {
        // setup
        startUpstream(404, "{\"message\":\"Resource Not Found\"}", null);
        stubFleetTool();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        RestProxyService service = service(true);

        // execution
        ResponseEntity<String> response = service.proxyApiRequest(FLEET,
                request("GET", "/tools/fleetmdm-server/api/v1/fleet/hosts/identifier/OTHER-TENANT-UUID"), null);

        // verifications
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isEqualTo("{\"message\":\"Resource Not Found\"}");
    }

    @Test
    void proxy_multiTenancyDisabled_offListPathForwardedWithoutTenantHeader() throws IOException {
        // setup
        startUpstream(200, "{}", null);
        stubFleetTool();
        RestProxyService service = service(false);

        // execution
        ResponseEntity<String> response = service.proxyApiRequest(FLEET,
                request("POST", "/tools/fleetmdm-server/api/v1/fleet/hosts/42/refetch"), null);

        // verifications
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(received.get().headers().containsKey(TENANT_HEADER)).isFalse();
        verifyNoInteractions(tenantIdProvider);
    }

    @Test
    void proxy_upstreamContentType_passedBack() throws IOException {
        // setup
        startUpstream(200, "{\"hosts\":[]}", "application/json; charset=utf-8");
        stubFleetTool();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        RestProxyService service = service(true);

        // execution
        ResponseEntity<String> response = service.proxyApiRequest(FLEET, request("GET", "/tools/fleetmdm-server/api/v1/fleet/hosts"), null);

        // verifications
        assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.parseMediaType("application/json; charset=utf-8"));
    }

    @Test
    void proxy_upstreamWithoutContentType_noContentTypeSet() throws IOException {
        // setup
        startUpstream(204, null, null);
        stubFleetTool();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        RestProxyService service = service(true);

        // execution
        ResponseEntity<String> response = service.proxyApiRequest(FLEET, request("GET", "/tools/fleetmdm-server/api/v1/fleet/hosts"), null);

        // verifications
        assertThat(response.getHeaders().getContentType()).isNull();
    }

    private RestProxyService service(boolean multiTenancy) {
        return service(multiTenancy, ALLOWED);
    }

    private RestProxyService service(boolean multiTenancy, List<String> allowed) {
        FleetProxyProperties properties = new FleetProxyProperties();
        properties.setEnabled(multiTenancy);
        properties.setAllowedEndpoints(allowed);
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("test");
        ProxyUrlResolver resolver = new ProxyUrlResolver(environment);
        FleetProxyGuard guard = new FleetProxyGuard(properties, tenantIdProvider);
        CloseableHttpClient httpClient = new ToolProxyHttpClientConfig().toolProxyHttpClient();
        return new RestProxyService(toolRepository, resolver, new ToolUrlService(), guard, httpClient);
    }

    private void stubFleetTool() {
        ToolApiKey apiKey = new ToolApiKey();
        apiKey.setType(APIKeyType.BEARER_TOKEN);
        apiKey.setKey(FLEET_TOKEN);
        ToolCredentials credentials = new ToolCredentials();
        credentials.setApiKey(apiKey);
        IntegratedTool tool = IntegratedTool.builder()
                .key(FLEET)
                .name("Fleet MDM Server")
                .enabled(true)
                .credentials(credentials)
                .toolUrls(List.of(new ToolUrl("http://127.0.0.1", String.valueOf(upstream.getAddress().getPort()), ToolUrlType.API)))
                .build();
        when(toolRepository.findByKey(FLEET)).thenReturn(Optional.of(tool));
    }

    private void startUpstream(int status, String body, String contentType) throws IOException {
        upstream = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        upstream.createContext("/", exchange -> {
            String requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            received.set(new Received(exchange.getRequestMethod(), exchange.getRequestURI().toString(),
                    exchange.getRequestHeaders(), requestBody));
            if (contentType != null) {
                exchange.getResponseHeaders().set("Content-Type", contentType);
            }
            if (body == null) {
                exchange.sendResponseHeaders(status, -1);
            } else {
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(status, bytes.length);
                exchange.getResponseBody().write(bytes);
            }
            exchange.close();
        });
        upstream.start();
    }

    private static MockHttpServletRequest request(String method, String uri) {
        return new MockHttpServletRequest(method, uri);
    }

    private static void assertEndpointNotAllowed(Throwable thrown) {
        assertThat(thrown).isInstanceOf(ForbiddenException.class);
        assertThat(((BaseException) thrown).getErrorCode()).isEqualTo(ErrorCode.ENDPOINT_NOT_ALLOWED);
    }

    private record Received(String method, String uri, Headers headers, String body) {
    }
}
