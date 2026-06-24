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
        return instrumentUpstream(url, delegate.execute(url, wrapHandler(url, handler)));
    }

    @Override
    public Mono<Void> execute(URI url, HttpHeaders headers, WebSocketHandler handler) {
        return instrumentUpstream(url, delegate.execute(url, headers, wrapHandler(url, handler)));
    }

    // Log the upstream proxy outcome: a connect failure/timeout to a dead upstream (e.g. meshcentral or NATS) is otherwise invisible here — the inbound upgrade just never completes and the agent sees "No HTTP response".
    private Mono<Void> instrumentUpstream(URI url, Mono<Void> proxy) {
        boolean debugPath = loggingProperties.isDebugPath(url.getPath());
        // Host+path only: the upstream URI can carry forwarded query params (e.g. an agent key), which must not be logged.
        String safeUrl = url.getScheme() + "://" + url.getHost() + (url.getPort() < 0 ? "" : ":" + url.getPort()) + url.getPath();
        return proxy
                .doOnSubscribe(s -> { if (debugPath) { log.debug("ws proxy: connecting to upstream {}", safeUrl); } })
                .doOnError(ex -> log.warn("ws proxy: upstream connect/relay failed for {}: {}", safeUrl, ex.toString()));
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
                    log.debug(LOG_PREFIX + "downstream proxy session opened", sessionId, target);
                }
                return handler.handle(proxySession)
                        .doFinally(signal -> {
                            if (proxySession.isOpen()) {
                                log.debug(LOG_PREFIX + "still open after relay completed (signal={}), closing",
                                        sessionId, target, signal);
                                proxySession.close(CloseStatus.GOING_AWAY)
                                        .timeout(CLOSE_TIMEOUT)
                                        .doOnSuccess(__ -> {
                                            if (debugPath) {
                                                log.debug(LOG_PREFIX + "downstream proxy session closed", sessionId, target);
                                            }
                                        })
                                        .onErrorResume(ex -> Mono.empty())
                                        .subscribe(null,
                                                ex -> log.error(LOG_PREFIX + "failed to close: {}",
                                                        sessionId, target, ex.getMessage()));
                            } else if (debugPath) {
                                log.debug(LOG_PREFIX + "relay completed, already closed (signal={})",
                                        sessionId, target, signal);
                            }
                        });
            }
        };
    }
}
