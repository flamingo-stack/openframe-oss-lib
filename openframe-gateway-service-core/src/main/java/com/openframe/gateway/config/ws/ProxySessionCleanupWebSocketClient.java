package com.openframe.gateway.config.ws;

import com.openframe.gateway.tenant.TenantRoutingHeaders;
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
    private final boolean cleanupEnabled;

    @Override
    public Mono<Void> execute(URI url, WebSocketHandler handler) {
        return decorateConnection(url, null, delegate.execute(url, wrapHandler(url, handler)));
    }

    @Override
    public Mono<Void> execute(URI url, HttpHeaders headers, WebSocketHandler handler) {
        String tenant = headers != null ? headers.getFirst(TenantRoutingHeaders.TENANT_ID_HEADER) : null;
        return decorateConnection(url, tenant, delegate.execute(url, headers, wrapHandler(url, handler)));
    }

    // Upstream connect/finish/failure logging. Gated by the global frame-logging switch rather than a
    // path prefix: this runs at the WebSocketClient level where the URL is the rewritten upstream
    // address, so per-path scoping is not meaningful here (frame logging itself is scoped on the
    // original request path in WebSocketServiceSecurityDecorator).
    private Mono<Void> decorateConnection(URI url, String tenant, Mono<Void> connection) {
        if (!loggingProperties.isFramePayloadLoggingEnabled()) {
            return connection;
        }
        String tnt = tenant == null ? "-" : tenant;
        return connection
                .doOnSubscribe(s -> log.debug("Debug ws upstream connecting url={} tenant={}", url, tnt))
                .doOnError(e -> log.warn("Debug ws upstream connection FAILED url={} tenant={} : {}",
                        url, tnt, e.toString(), e))
                .doOnSuccess(v -> log.debug("Debug ws upstream relay finished url={} tenant={}", url, tnt));
    }

    private WebSocketHandler wrapHandler(URI targetUrl, WebSocketHandler handler) {
        String target = targetUrl.getPath();
        boolean debugPath = loggingProperties.isDebugPath(target);

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
                            if (!cleanupEnabled) {
                                return;
                            }
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
