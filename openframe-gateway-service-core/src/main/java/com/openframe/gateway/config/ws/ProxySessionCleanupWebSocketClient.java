package com.openframe.gateway.config.ws;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.reactive.socket.adapter.ReactorNettyWebSocketSessionCloser;
import org.springframework.web.reactive.socket.client.WebSocketClient;
import reactor.core.publisher.Mono;
import reactor.core.publisher.SignalType;

import java.net.URI;
import java.time.Duration;
import java.util.List;

@RequiredArgsConstructor
@Slf4j
public class ProxySessionCleanupWebSocketClient implements WebSocketClient {

    /**
     * Delay before force-closing a proxy session after normal relay completion.
     * Gives Reactor Netty time to complete its own close handshake (sendCloseNow)
     * without our close call racing it and causing StacklessClosedChannelException.
     */
    private static final Duration CLOSE_DELAY = Duration.ofSeconds(2);

    private final WebSocketClient delegate;

    @Override
    public Mono<Void> execute(URI url, WebSocketHandler handler) {
        return delegate.execute(url, wrapHandler(handler));
    }

    @Override
    public Mono<Void> execute(URI url, HttpHeaders headers, WebSocketHandler handler) {
        return delegate.execute(url, headers, wrapHandler(handler));
    }

    private WebSocketHandler wrapHandler(WebSocketHandler handler) {
        return new WebSocketHandler() {
            @Override
            public List<String> getSubProtocols() {
                return handler.getSubProtocols();
            }

            @Override
            public Mono<Void> handle(WebSocketSession proxySession) {
                return handler.handle(proxySession)
                        .doFinally(signal -> {
                            if (!proxySession.isOpen()) {
                                return;
                            }
                            if (signal == SignalType.ON_COMPLETE) {
                                // On normal completion, delay our close to avoid racing with
                                // Reactor Netty's internal close handshake (sendCloseNow),
                                // which causes StacklessClosedChannelException and onErrorDropped.
                                // The delay still acts as a safety net if Netty doesn't close.
                                Mono.delay(CLOSE_DELAY)
                                        .subscribe(
                                                __ -> {
                                                    if (proxySession.isOpen()) {
                                                        log.debug("Proxy session {} still open {}ms after relay completed, closing",
                                                                proxySession.getId(), CLOSE_DELAY.toMillis());
                                                        ReactorNettyWebSocketSessionCloser.closeGracefully(proxySession, CloseStatus.GOING_AWAY)
                                                                .subscribe();
                                                    }
                                                },
                                                ex -> log.debug("Error in delayed proxy session close for {}: {}",
                                                        proxySession.getId(), ex.getMessage())
                                        );
                            } else {
                                log.warn("Proxy session {} still open after relay completed (signal={}), closing",
                                        proxySession.getId(), signal);
                                ReactorNettyWebSocketSessionCloser.closeGracefully(proxySession, CloseStatus.GOING_AWAY)
                                        .subscribe();
                            }
                        });
            }
        };
    }
}
