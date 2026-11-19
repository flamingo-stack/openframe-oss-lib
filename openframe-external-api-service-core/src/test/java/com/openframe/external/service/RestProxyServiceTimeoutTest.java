package com.openframe.external.service;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.ToolUrlService;
import com.openframe.external.config.ToolProxyHttpClientConfig;
import com.openframe.external.exception.ToolProxyException;
import com.sun.net.httpserver.HttpServer;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RestProxyServiceTimeoutTest {

    private static final String TOOL_ID = "tactical-rmm";
    private static final Duration SHORT = Duration.ofMillis(300);
    private static final String UNROUTABLE_HOST = "http://10.255.255.1";

    @Mock
    private IntegratedToolRepository toolRepository;

    @Mock
    private FleetProxyGuard fleetProxyGuard;

    private HttpServer upstream;

    @AfterEach
    void stopUpstream() {
        if (upstream != null) {
            upstream.stop(0);
        }
    }

    @Test
    void proxy_connectionRefused_throwsToolUnreachable() throws IOException {
        // setup
        int closedPort = closedPort();
        stubTool("http://127.0.0.1", String.valueOf(closedPort));
        RestProxyService service = service(SHORT, SHORT);

        // execution
        Throwable thrown = catchThrowable(() -> service.proxyApiRequest(TOOL_ID, request(), null));

        // verifications
        assertToolProxyFailure(thrown, ErrorCode.TOOL_UNREACHABLE, HttpStatus.BAD_GATEWAY);
        assertThat(thrown.getMessage()).doesNotContain("127.0.0.1").doesNotContain(String.valueOf(closedPort));
    }

    @Test
    void proxy_unroutableHost_throwsToolUnreachableWithinConnectTimeout() {
        // setup
        stubTool(UNROUTABLE_HOST, "81");
        RestProxyService service = service(SHORT, Duration.ofSeconds(25));
        long started = System.nanoTime();

        // execution
        Throwable thrown = catchThrowable(() -> service.proxyApiRequest(TOOL_ID, request(), null));

        // verifications
        assertThat(Duration.ofNanos(System.nanoTime() - started)).isLessThan(Duration.ofSeconds(3));
        assertToolProxyFailure(thrown, ErrorCode.TOOL_UNREACHABLE, HttpStatus.BAD_GATEWAY);
        assertThat(thrown.getMessage()).doesNotContain("10.255.255.1");
    }

    @Test
    void proxy_slowUpstream_throwsToolTimeoutWithinResponseTimeout() throws IOException {
        // setup
        startSlowUpstream(Duration.ofSeconds(1));
        stubTool("http://127.0.0.1", String.valueOf(upstream.getAddress().getPort()));
        RestProxyService service = service(Duration.ofSeconds(5), SHORT);
        long started = System.nanoTime();

        // execution
        Throwable thrown = catchThrowable(() -> service.proxyApiRequest(TOOL_ID, request(), null));

        // verifications
        assertThat(Duration.ofNanos(System.nanoTime() - started)).isLessThan(Duration.ofSeconds(2));
        assertToolProxyFailure(thrown, ErrorCode.TOOL_TIMEOUT, HttpStatus.GATEWAY_TIMEOUT);
        assertThat(thrown.getMessage()).doesNotContain("127.0.0.1");
    }

    @Test
    void proxy_toolFailure_messageNamesTheTool() throws IOException {
        // setup
        stubTool("http://127.0.0.1", String.valueOf(closedPort()));
        RestProxyService service = service(SHORT, SHORT);

        // execution
        Throwable thrown = catchThrowable(() -> service.proxyApiRequest(TOOL_ID, request(), null));

        // verifications
        assertThat(thrown).hasMessageContaining(TOOL_ID);
    }

    private RestProxyService service(Duration connectTimeout, Duration responseTimeout) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("test");
        ProxyUrlResolver resolver = new ProxyUrlResolver(environment);
        CloseableHttpClient httpClient = ToolProxyHttpClientConfig.create(connectTimeout, responseTimeout);
        return new RestProxyService(toolRepository, resolver, new ToolUrlService(), fleetProxyGuard, httpClient);
    }

    private void stubTool(String url, String port) {
        IntegratedTool tool = IntegratedTool.builder()
                .key(TOOL_ID)
                .name("Tactical RMM")
                .enabled(true)
                .toolUrls(List.of(new ToolUrl(url, port, ToolUrlType.API)))
                .build();
        when(toolRepository.findByKey(TOOL_ID)).thenReturn(Optional.of(tool));
    }

    private void startSlowUpstream(Duration delay) throws IOException {
        upstream = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        upstream.createContext("/", exchange -> {
            try {
                Thread.sleep(delay.toMillis());
                exchange.sendResponseHeaders(200, -1);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
            }
        });
        upstream.start();
    }

    private static int closedPort() throws IOException {
        try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            return socket.getLocalPort();
        }
    }

    private static MockHttpServletRequest request() {
        return new MockHttpServletRequest("GET", "/tools/tactical-rmm/api/v1/agents");
    }

    private static void assertToolProxyFailure(Throwable thrown, ErrorCode code, HttpStatus status) {
        assertThat(thrown).isInstanceOf(ToolProxyException.class);
        assertThat(((ToolProxyException) thrown).getErrorCode()).isEqualTo(code);
        assertThat(((ToolProxyException) thrown).getHttpStatus()).isEqualTo(status);
    }
}
