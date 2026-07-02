package com.openframe.gateway.config.ws;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.reactive.socket.client.WebSocketClient;
import reactor.core.publisher.Mono;
import reactor.core.publisher.SignalType;

import java.net.URI;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProxySessionCleanupWebSocketClientTest {

    @Test
    void isPeerClosed_trueForTeardownRaces() {
        assertThat(ProxySessionCleanupWebSocketClient.isPeerClosed(new RuntimeException(
                "reactor.netty.channel.AbortedException: Connection has been closed BEFORE send operation"))).isTrue();
        assertThat(ProxySessionCleanupWebSocketClient.isPeerClosed(
                new java.io.IOException("Connection reset by peer"))).isTrue();
    }

    @Test
    void isPeerClosed_falseForRealConnectFailure() {
        assertThat(ProxySessionCleanupWebSocketClient.isPeerClosed(
                new java.net.ConnectException("Connection refused"))).isFalse();
    }

    // --- relayStarted gating: a peer-closed error is only the expected teardown race (DEBUG) once the
    //     upstream WS is relaying; the same error during connect/handshake is a real failure (WARN). ---

    private static final URI MESH_URL = URI.create("ws://mesh/tenant-x/agent.ashx");
    private static final String PEER_ABORT =
            "reactor.netty.channel.AbortedException: Connection has been closed BEFORE send operation";

    private Logger clientLogger;
    private ListAppender<ILoggingEvent> appender;

    @BeforeEach
    void attachAppender() {
        clientLogger = (Logger) LoggerFactory.getLogger(ProxySessionCleanupWebSocketClient.class);
        clientLogger.setLevel(Level.DEBUG);
        appender = new ListAppender<>();
        appender.start();
        clientLogger.addAppender(appender);
    }

    @AfterEach
    void detachAppender() {
        clientLogger.detachAppender(appender);
    }

    @Test
    void peerClosedBeforeRelayStarts_logsWarn() {
        // Delegate fails during connect/handshake: the wrapped handler is never invoked -> relayStarted stays false.
        WebSocketClient delegate = mock(WebSocketClient.class);
        when(delegate.execute(any(), any(HttpHeaders.class), any()))
                .thenReturn(Mono.error(new RuntimeException(PEER_ABORT)));

        client(delegate).execute(MESH_URL, new HttpHeaders(), session -> Mono.empty())
                .onErrorResume(e -> Mono.empty()).block();

        assertThat(levelOf("connection FAILED")).isEqualTo(Level.WARN);
    }

    @Test
    void peerClosedAfterRelayStarts_logsDebug() {
        // Delegate starts the relay (invokes the wrapped handler) and then the peer aborts mid-relay.
        WebSocketSession upstream = mock(WebSocketSession.class);
        when(upstream.getId()).thenReturn("up-1");
        WebSocketClient delegate = mock(WebSocketClient.class);
        when(delegate.execute(any(), any(HttpHeaders.class), any())).thenAnswer(invocation -> {
            WebSocketHandler wrapped = invocation.getArgument(2);
            return wrapped.handle(upstream).then(Mono.error(new RuntimeException(PEER_ABORT)));
        });

        client(delegate).execute(MESH_URL, new HttpHeaders(), session -> Mono.empty())
                .onErrorResume(e -> Mono.empty()).block();

        assertThat(levelOf("relay ended (peer closed)")).isEqualTo(Level.DEBUG);
    }

    @Test
    void upstreamLogs_takeSubFromSecurityContext() {
        WebSocketClient delegate = mock(WebSocketClient.class);
        when(delegate.execute(any(), any(HttpHeaders.class), any())).thenReturn(Mono.empty());

        client(delegate).execute(MESH_URL, new HttpHeaders(), session -> Mono.empty())
                .contextWrite(ReactiveSecurityContextHolder.withAuthentication(
                        new TestingAuthenticationToken("agent_x", "n/a")))
                .block();

        assertThat(appender.list.stream().map(ILoggingEvent::getFormattedMessage))
                .anyMatch(m -> m.contains("relay finished") && m.contains("sub=agent_x"));
    }

    @Test
    void upstreamLogs_fallBackToDashWithoutSecurityContext() {
        WebSocketClient delegate = mock(WebSocketClient.class);
        when(delegate.execute(any(), any(HttpHeaders.class), any())).thenReturn(Mono.empty());

        client(delegate).execute(MESH_URL, new HttpHeaders(), session -> Mono.empty()).block();

        assertThat(appender.list.stream().map(ILoggingEvent::getFormattedMessage))
                .anyMatch(m -> m.contains("relay finished") && m.contains("sub=-"));
    }

    // --- proxy-cleanup: force-close only a GENUINELY leaked upstream. The normal teardown is raced
    //     event-driven via closeStatus(), so no second CloseWebSocketFrame is ever sent. ---

    private static final Duration TEST_GRACE = Duration.ofMillis(20);

    @Test
    void closeIfLeaked_alreadyClosed_doesNotForceClose() {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.isOpen()).thenReturn(false);

        ProxySessionCleanupWebSocketClient
                .closeIfLeaked(session, "s1", "/ws/nats-api", false, SignalType.ON_COMPLETE, TEST_GRACE)
                .block();

        verify(session, never()).close(any());
    }

    @Test
    void closeIfLeaked_naturalCloseWinsTheRace_doesNotForceClose() {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.isOpen()).thenReturn(true);
        when(session.closeStatus()).thenReturn(Mono.empty());   // close signal arrives before the grace

        ProxySessionCleanupWebSocketClient
                // long grace: completion must come from the closeStatus() branch, not the timer
                .closeIfLeaked(session, "s2", "/ws/nats-api", false, SignalType.ON_COMPLETE, Duration.ofMinutes(1))
                .block();

        verify(session, never()).close(any());   // no second CloseWebSocketFrame -> no double-release
    }

    @Test
    void closeIfLeaked_stillOpenAfterGrace_forceCloses() {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.isOpen()).thenReturn(true);
        when(session.closeStatus()).thenReturn(Mono.never());   // no close signal -> genuinely leaked
        when(session.close(any())).thenReturn(Mono.empty());

        ProxySessionCleanupWebSocketClient
                .closeIfLeaked(session, "s3", "/ws/nats-api", false, SignalType.ON_COMPLETE, TEST_GRACE)
                .block();

        verify(session, times(1)).close(CloseStatus.GOING_AWAY);
    }

    private static ProxySessionCleanupWebSocketClient client(WebSocketClient delegate) {
        WebSocketLoggingProperties props = new WebSocketLoggingProperties();
        props.setFramePayloadLoggingEnabled(true);
        return new ProxySessionCleanupWebSocketClient(delegate, props, false);
    }

    private Level levelOf(String messageSubstring) {
        return appender.list.stream()
                .filter(e -> e.getFormattedMessage().contains(messageSubstring))
                .map(ILoggingEvent::getLevel)
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        "no log line containing \"" + messageSubstring + "\" — saw: " + appender.list));
    }
}
