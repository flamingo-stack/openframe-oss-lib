package com.openframe.gateway.config.ws;

import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import com.openframe.gateway.metrics.WebSocketKind;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.RequestPath;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.reactive.socket.server.WebSocketService;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.Disposable;
import reactor.core.Disposables;
import reactor.core.publisher.Mono;
import reactor.test.publisher.PublisherProbe;
import reactor.test.scheduler.VirtualTimeScheduler;
import reactor.util.context.Context;
import reactor.util.context.ContextView;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WebSocketServiceSecurityDecoratorExpiryTest {

    private static final String SESSION_ID = "session-1";
    private static final String SUBJECT = "agent_8daa5e90-707c-4fab-8cda-d11550b0d26b";
    private static final String MACHINE_ID = "8daa5e90-707c-4fab-8cda-d11550b0d26b";
    private static final String TENANT_ID = "4d256d67-c365-4e25-ba89-4e0e767c5036";
    private static final String TOOL = "meshcentral-server";
    private static final String BROWSER_RELAY_PATH = "/ws/tools/meshcentral-server/meshrelay.ashx";
    private static final String AGENT_RELAY_PATH = "/ws/tools/agent/meshcentral-server/meshrelay.ashx";
    private static final String CONTEXT_KEY = "shared-domain";
    private static final String CONTEXT_VALUE = "dev";
    private static final Duration TOKEN_LIFETIME = Duration.ofHours(1);
    private static final Duration PAST_EXPIRY = Duration.ofHours(2);
    private static final Duration SESSION_CAP = Duration.ofHours(3);
    private static final Duration JUST_BEFORE_SESSION_CAP = SESSION_CAP.minusSeconds(1);

    @Mock private WebSocketService defaultWebSocketService;
    @Mock private RequestJwtClaimsReader requestJwtReader;
    @Mock private GatewayTrafficMetrics gatewayTrafficMetrics;
    @Mock private RelayAccessWatcher relayAccessWatcher;
    @Mock private ServerWebExchange exchange;
    @Mock private ServerHttpRequest request;
    @Mock private RequestPath requestPath;
    @Mock private WebSocketSession clientSession;
    @Mock private WebSocketHandler proxyHandler;

    @Captor private ArgumentCaptor<RelayDevice> deviceCaptor;
    @Captor private ArgumentCaptor<ContextView> contextCaptor;

    private WebSocketServiceSecurityDecorator decorator;
    private VirtualTimeScheduler virtualTime;
    private Instant expiresAt;
    private Disposable deviceWatch;

    @BeforeEach
    void setUp() {
        virtualTime = VirtualTimeScheduler.getOrSet();
        expiresAt = Instant.now().plus(TOKEN_LIFETIME);
        deviceWatch = Disposables.single();
        RemoteSessionCapProperties sessionCap = new RemoteSessionCapProperties();
        sessionCap.setMaxDurationSeconds(SESSION_CAP.getSeconds());
        decorator = new WebSocketServiceSecurityDecorator(defaultWebSocketService, requestJwtReader,
                gatewayTrafficMetrics, new WebSocketLoggingProperties(), new MeshControlCommandProperties(),
                new ObjectMapper(), relayAccessWatcher, sessionCap);
    }

    @AfterEach
    void tearDown() {
        VirtualTimeScheduler.reset();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            BROWSER_RELAY_PATH,
            "/ws/tools/meshcentral-server/MeshRelay.ashx/"
    })
    void handleRequest_browserRelayPastTokenExpiry_sessionKeptOpenWithoutWatch(String path) {
        // setup
        stubOpenSession(path, Mono.never());
        when(requestJwtReader.getMachineId(exchange)).thenReturn(Optional.empty());

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();
        virtualTime.advanceTimeBy(PAST_EXPIRY);

        // verifications
        verify(clientSession, never()).close();
        verifyNoInteractions(relayAccessWatcher);
    }

    @Test
    void handleRequest_agentRelayPastTokenExpiry_sessionKeptOpen() {
        // setup
        stubOpenSession(AGENT_RELAY_PATH, Mono.never());
        stubAgentRelayWatch();

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();
        virtualTime.advanceTimeBy(PAST_EXPIRY);

        // verifications
        verify(clientSession, never()).close();
    }

    @Test
    void handleRequest_agentRelay_watchedForItsDevice() {
        // setup
        stubOpenSession(AGENT_RELAY_PATH, Mono.never());
        stubAgentRelayWatch();

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();

        // verifications
        verify(relayAccessWatcher).watch(eq(clientSession), deviceCaptor.capture(),
                eq(expiresAt.plusSeconds(WebSocketServiceSecurityDecorator.CLOCK_SKEW_SECONDS)),
                any(ContextView.class));
        assertThat(deviceCaptor.getValue())
                .extracting(RelayDevice::getTenantId, RelayDevice::getMachineId)
                .containsExactly(TENANT_ID, MACHINE_ID);
    }

    @Test
    void handleRequest_agentRelay_watchCarriesTheRequestContext() {
        // setup
        stubOpenSession(AGENT_RELAY_PATH, Mono.never());
        stubAgentRelayWatch();
        Context requestContext = Context.of(CONTEXT_KEY, CONTEXT_VALUE);

        // execution
        decorator.handleRequest(exchange, proxyHandler).contextWrite(requestContext).block();

        // verifications
        verify(relayAccessWatcher).watch(eq(clientSession), any(RelayDevice.class), any(Instant.class),
                contextCaptor.capture());
        assertThat(contextCaptor.getValue().getOrDefault(CONTEXT_KEY, "")).isEqualTo(CONTEXT_VALUE);
    }

    @Test
    void handleRequest_browserRelayAtSessionCap_sessionClosed() {
        // setup
        stubOpenSession(BROWSER_RELAY_PATH, Mono.never());
        when(requestJwtReader.getMachineId(exchange)).thenReturn(Optional.empty());
        when(clientSession.close()).thenReturn(Mono.empty());

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();
        virtualTime.advanceTimeBy(SESSION_CAP);

        // verifications
        verify(clientSession).close();
    }

    @Test
    void handleRequest_agentRelayAtSessionCap_sessionClosed() {
        // setup
        stubOpenSession(AGENT_RELAY_PATH, Mono.never());
        stubAgentRelayWatch();
        when(clientSession.close()).thenReturn(Mono.empty());

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();
        virtualTime.advanceTimeBy(SESSION_CAP);

        // verifications
        verify(clientSession).close();
    }

    @ParameterizedTest
    @ValueSource(strings = {BROWSER_RELAY_PATH, AGENT_RELAY_PATH})
    void handleRequest_relayJustBeforeSessionCap_sessionKeptOpen(String path) {
        // setup
        stubOpenSession(path, Mono.never());
        when(requestJwtReader.getMachineId(exchange)).thenReturn(Optional.empty());

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();
        virtualTime.advanceTimeBy(JUST_BEFORE_SESSION_CAP);

        // verifications
        verify(clientSession, never()).close();
    }

    @Test
    void handleRequest_agentRelayClosed_deviceWatchStopped() {
        // setup
        stubOpenSession(AGENT_RELAY_PATH, Mono.just(CloseStatus.NORMAL));
        stubAgentRelayWatch();

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();

        // verifications
        assertThat(deviceWatch.isDisposed()).isTrue();
    }

    @Test
    void handleRequest_relayClosedBeforeSessionCap_capCloseCancelled() {
        // setup
        stubOpenSession(BROWSER_RELAY_PATH, Mono.just(CloseStatus.NORMAL));
        when(requestJwtReader.getMachineId(exchange)).thenReturn(Optional.empty());

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();
        virtualTime.advanceTimeBy(SESSION_CAP);

        // verifications
        verify(clientSession, never()).close();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/ws/tools/agent/meshcentral-server/agent.ashx",
            "/ws/tools/meshcentral-server/control.ashx",
            "/ws/nats",
            "/ws/nats-api"
    })
    void handleRequest_nonRelayPastTokenExpiry_sessionClosed(String path) {
        // setup
        stubOpenSession(path, Mono.never());
        when(clientSession.close()).thenReturn(Mono.empty());

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();
        virtualTime.advanceTimeBy(PAST_EXPIRY);

        // verifications
        verify(clientSession).close();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/ws/tools/agent/meshcentral-server/agent.ashx",
            "/ws/tools/meshcentral-server/control.ashx"
    })
    void handleRequest_nonRelayBeforeTokenExpiry_sessionKeptOpen(String path) {
        // setup
        stubOpenSession(path, Mono.never());

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();
        virtualTime.advanceTimeBy(TOKEN_LIFETIME);

        // verifications
        verify(clientSession, never()).close();
        verifyNoInteractions(relayAccessWatcher);
    }

    @Test
    void handleRequest_browserRelayClosed_closeRecordedAsRelay() {
        // setup
        stubOpenSession(BROWSER_RELAY_PATH, Mono.just(CloseStatus.NORMAL));
        when(requestJwtReader.getMachineId(exchange)).thenReturn(Optional.empty());

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();

        // verifications
        verify(gatewayTrafficMetrics).recordSessionClosed(TOOL, WebSocketKind.RELAY, CloseStatus.NORMAL.getCode(), 0L);
    }

    @Test
    void handleRequest_agentRelayClosed_closeRecordedAsRelay() {
        // setup
        stubOpenSession(AGENT_RELAY_PATH, Mono.just(CloseStatus.NORMAL));
        stubAgentRelayWatch();

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();

        // verifications
        verify(gatewayTrafficMetrics).recordSessionClosed(TOOL, WebSocketKind.RELAY, CloseStatus.NORMAL.getCode(), 0L);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/ws/tools/agent/meshcentral-server/agent.ashx",
            "/ws/tools/meshcentral-server/control.ashx",
            "/ws/nats"
    })
    void handleRequest_nonRelayClosedBeforeExpiry_expiryCloseCancelled(String path) {
        // setup
        stubOpenSession(path, Mono.just(CloseStatus.NORMAL));

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();
        virtualTime.advanceTimeBy(PAST_EXPIRY);

        // verifications
        verify(clientSession, never()).close();
    }

    @Test
    void handleRequest_tokenExpiryUnreadable_sessionClosed() {
        // setup
        PublisherProbe<Void> closeProbe = PublisherProbe.empty();
        stubSecuredPath(AGENT_RELAY_PATH);
        when(requestJwtReader.getSubject(exchange)).thenReturn(Optional.of(SUBJECT));
        when(requestJwtReader.getExpiration(exchange)).thenThrow(new IllegalStateException("No Authorization header found"));
        when(clientSession.getId()).thenReturn(SESSION_ID);
        when(clientSession.close()).thenReturn(closeProbe.mono());
        when(defaultWebSocketService.handleRequest(eq(exchange), any(WebSocketHandler.class)))
                .thenAnswer(invocation -> invocation.<WebSocketHandler>getArgument(1).handle(clientSession));

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();

        // verifications
        assertThat(closeProbe.wasSubscribed()).isTrue();
    }

    @Test
    void handleRequest_unsecuredPath_handedToDefaultHandler() {
        // setup
        PublisherProbe<Void> handled = PublisherProbe.empty();
        stubSecuredPath("/ws/other");
        when(defaultWebSocketService.handleRequest(exchange, proxyHandler)).thenReturn(handled.mono());

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();

        // verifications
        assertThat(handled.wasSubscribed()).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/ws/tools/agent/meshcentral-server/agent.ashx",
            "/ws/tools/meshcentral-server/control.ashx"
    })
    void handleRequest_securedSession_openingRecorded(String path) {
        // setup
        stubOpenSession(path, Mono.never());

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();

        // verifications
        verify(gatewayTrafficMetrics).webSocketOpened(SESSION_ID, path, SUBJECT);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/ws/tools/agent/meshcentral-server/agent.ashx",
            "/ws/tools/meshcentral-server/control.ashx"
    })
    void handleRequest_nonRelayClosed_closeRecordedAsNotRelay(String path) {
        // setup
        stubOpenSession(path, Mono.just(CloseStatus.NORMAL));

        // execution
        decorator.handleRequest(exchange, proxyHandler).block();

        // verifications
        verify(gatewayTrafficMetrics).recordSessionClosed(TOOL, WebSocketKind.CHANNEL, CloseStatus.NORMAL.getCode(), 0L);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            BROWSER_RELAY_PATH,
            AGENT_RELAY_PATH,
            "/ws/tools/meshcentral-server/MESHRELAY.ASHX",
            "/ws/tools/meshcentral-server/meshrelay.ashx//"
    })
    void isRelayPath_relayEndpoint_true(String path) {
        // setup

        // execution
        boolean relay = WebSocketServiceSecurityDecorator.isRelayPath(path);

        // verifications
        assertThat(relay).isTrue();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {
            "",
            "/ws/tools/meshcentral-server/control.ashx",
            "/ws/tools/agent/meshcentral-server/agent.ashx",
            "/ws/tools/meshcentral-server/meshrelay.ashx.bak",
            "/ws/toolsx/meshrelay.ashx",
            "/ws/nats",
            "/meshrelay.ashx"
    })
    void isRelayPath_otherPath_false(String path) {
        // setup

        // execution
        boolean relay = WebSocketServiceSecurityDecorator.isRelayPath(path);

        // verifications
        assertThat(relay).isFalse();
    }

    private void stubSecuredPath(String path) {
        when(exchange.getRequest()).thenReturn(request);
        when(request.getPath()).thenReturn(requestPath);
        when(requestPath.value()).thenReturn(path);
    }

    private void stubOpenSession(String path, Mono<CloseStatus> closeStatus) {
        stubSecuredPath(path);
        when(requestJwtReader.getSubject(exchange)).thenReturn(Optional.of(SUBJECT));
        when(requestJwtReader.getExpiration(exchange)).thenReturn(expiresAt);
        when(clientSession.getId()).thenReturn(SESSION_ID);
        when(clientSession.closeStatus()).thenReturn(closeStatus);
        when(proxyHandler.handle(clientSession)).thenReturn(Mono.empty());
        when(defaultWebSocketService.handleRequest(eq(exchange), any(WebSocketHandler.class)))
                .thenAnswer(invocation -> invocation.<WebSocketHandler>getArgument(1).handle(clientSession));
    }

    private void stubAgentRelayWatch() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Tenant-Id", TENANT_ID);
        when(request.getHeaders()).thenReturn(headers);
        when(requestJwtReader.getMachineId(exchange)).thenReturn(Optional.of(MACHINE_ID));
        when(relayAccessWatcher.watch(eq(clientSession), any(RelayDevice.class), any(Instant.class),
                any(ContextView.class))).thenReturn(deviceWatch);
    }
}
