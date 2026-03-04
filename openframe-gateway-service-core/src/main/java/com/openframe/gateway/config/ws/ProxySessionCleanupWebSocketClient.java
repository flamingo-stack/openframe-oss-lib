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

import java.net.URI;
import java.util.List;

@RequiredArgsConstructor
@Slf4j
public class ProxySessionCleanupWebSocketClient implements WebSocketClient {

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
                            if (proxySession.isOpen()) {
                                log.warn("Proxy session {} still open after relay completed (signal={}), closing",
                                         proxySession.getId(), signal);
                                ReactorNettyWebSocketSessionCloser.closeGracefully(proxySession, CloseStatus.GOING_AWAY)
                                        .subscribe(null,
                                                ex -> log.error("Failed to close proxy session {}: {}",
                                                        proxySession.getId(), ex.getMessage()));
                            }
                        });
            }
        };
    }
}
