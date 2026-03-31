package com.openframe.gateway.config.ws;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.reactive.socket.client.WebSocketClient;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.time.Duration;
import java.util.List;

@RequiredArgsConstructor
@Slf4j
public class ProxySessionCleanupWebSocketClient implements WebSocketClient {

    private static final String LOG_PREFIX = "Debug ws proxy sessionId={} path={} | ";
    private static final Duration CLOSE_TIMEOUT = Duration.ofSeconds(5);

    private final WebSocketClient delegate;
    private final WebSocketLoggingProperties loggingProperties;

    @Override
    public Mono<Void> execute(URI url, WebSocketHandler handler) {
        return delegate.execute(url, wrapHandler(url, handler));
    }

    @Override
    public Mono<Void> execute(URI url, HttpHeaders headers, WebSocketHandler handler) {
        return delegate.execute(url, headers, wrapHandler(url, handler));
    }

    private WebSocketHandler wrapHandler(URI targetUrl, WebSocketHandler handler) {
        String target = targetUrl.getPath();
        boolean debugPath = loggingProperties.isDebugPath(targetUrl.getPath());

        return new WebSocketHandler() {
            @Override
            public List<String> getSubProtocols() {
                return handler.getSubProtocols();
            }

            @Override
            public Mono<Void> handle(WebSocketSession proxySession) {
                String sessionId = proxySession.getId();
                if (debugPath) {
                    log.info(LOG_PREFIX + "downstream proxy session opened", sessionId, target);
                }
                return handler.handle(proxySession)
                        .doFinally(signal -> {
                            if (proxySession.isOpen()) {
                                log.warn(LOG_PREFIX + "still open after relay completed (signal={}), closing",
                                        sessionId, target, signal);
                                proxySession.close(CloseStatus.GOING_AWAY)
                                        .timeout(CLOSE_TIMEOUT)
                                        .doOnSuccess(__ -> {
                                            if (debugPath) {
                                                log.info(LOG_PREFIX + "downstream proxy session closed", sessionId, target);
                                            }
                                        })
                                        .onErrorResume(ex -> Mono.empty())
                                        .subscribe(null,
                                                ex -> log.error(LOG_PREFIX + "failed to close: {}",
                                                        sessionId, target, ex.getMessage()));
                            } else if (debugPath) {
                                log.info(LOG_PREFIX + "relay completed, already closed (signal={})",
                                        sessionId, target, signal);
                            }
                        });
            }
        };
    }
}
