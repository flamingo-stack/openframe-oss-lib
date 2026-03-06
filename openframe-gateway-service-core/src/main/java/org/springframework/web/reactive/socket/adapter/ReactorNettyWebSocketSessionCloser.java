package org.springframework.web.reactive.socket.adapter;

import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Mono;
import reactor.netty.Connection;

import java.time.Duration;

public final class ReactorNettyWebSocketSessionCloser {

    private static final Duration CLOSE_TIMEOUT = Duration.ofSeconds(5);

    private ReactorNettyWebSocketSessionCloser() {}

    /**
     * Gracefully close the WS session (5s timeout for close handshake),
     * then force-dispose the underlying TCP connection to prevent CLOSE_WAIT zombies.
     */
    public static Mono<Void> closeGracefully(WebSocketSession session, CloseStatus status) {
        return session.close(status)
                .timeout(CLOSE_TIMEOUT)
                .onErrorResume(ex -> Mono.empty())
                .doFinally(signal -> forceDisposeConnection(session));
    }

    private static void forceDisposeConnection(WebSocketSession session) {
        if (session instanceof ReactorNettyWebSocketSession rns) {
            try {
                ReactorNettyWebSocketSession.WebSocketConnection delegate = rns.getDelegate();
                delegate.getInbound().withConnection(Connection::dispose);
            } catch (Exception e) {
                // Best-effort — session may already be fully closed
            }
        }
    }
}
