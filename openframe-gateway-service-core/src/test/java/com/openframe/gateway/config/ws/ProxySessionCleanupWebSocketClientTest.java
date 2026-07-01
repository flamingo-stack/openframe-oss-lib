package com.openframe.gateway.config.ws;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.reactive.socket.client.WebSocketClient;
import reactor.core.publisher.Mono;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
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

    @Test
    void subFrom_readsBearerHeader() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + unsignedJwt("agent_x"));

        assertThat(ProxySessionCleanupWebSocketClient.subFrom(URI.create("ws://h/agent.ashx"), headers))
                .isEqualTo("agent_x");
    }

    @Test
    void subFrom_fallsBackToQueryParam() {
        URI url = URI.create("ws://h/natsws?authorization=" + unsignedJwt("agent_q"));

        assertThat(ProxySessionCleanupWebSocketClient.subFrom(url, new HttpHeaders())).isEqualTo("agent_q");
    }

    @Test
    void subFrom_nullWhenAbsent() {
        assertThat(ProxySessionCleanupWebSocketClient.subFrom(URI.create("ws://h/x"), new HttpHeaders())).isNull();
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

    // Unsecured JWT (alg=none) — subFrom reads claims without verifying the signature.
    private static String unsignedJwt(String sub) {
        return Jwts.builder().setSubject(sub).compact();
    }
}
