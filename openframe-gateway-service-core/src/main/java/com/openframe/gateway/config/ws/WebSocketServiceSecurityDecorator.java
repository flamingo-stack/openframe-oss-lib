package com.openframe.gateway.config.ws;

import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.reactive.socket.server.WebSocketService;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.Disposable;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import static com.openframe.gateway.config.ws.WebSocketGatewayConfig.*;

@RequiredArgsConstructor
@Slf4j
public class WebSocketServiceSecurityDecorator implements WebSocketService {

    private static final String LOG_PREFIX = "Debug ws sessionId={} path={} sub={} | ";

    public static final long CLOCK_SKEW_SECONDS = 60; // align with Spring Security default skew

    private final WebSocketService defaultWebSocketService;
    private final RequestJwtClaimsReader requestJwtReader;
    private final GatewayTrafficMetrics gatewayTrafficMetrics;
    private final WebSocketLoggingProperties loggingProperties;

    private final ConcurrentMap<String, SessionInfo> sessionRegistry = new ConcurrentHashMap<>();

    private record SessionInfo(Instant createdAt, String path, String sub) {}

    @Override
    public Mono<Void> handleRequest(ServerWebExchange exchange, WebSocketHandler defaultWebSocketHandler) {
        String path = exchange.getRequest().getPath().value();

        if (isSecuredEndpoint(path)) {
            return defaultWebSocketService.handleRequest(exchange, session -> {
                String sessionId = session.getId();
                String sub = requestJwtReader.getSubject(exchange).orElse("-");
                boolean debugPath = loggingProperties.isDebugPath(path);

                sessionRegistry.put(sessionId, new SessionInfo(Instant.now(), path, sub));

                try {
                    Instant expiresAt = requestJwtReader.getExpiration(exchange);

                    gatewayTrafficMetrics.webSocketOpened();
                    if (debugPath) {
                        log.info(LOG_PREFIX + "session opened, scheduling JWT expiry close", sessionId, path, sub);
                    }

                    long secondsUntilExpiration = Duration.between(Instant.now(), expiresAt).getSeconds();
                    long effectiveSeconds = secondsUntilExpiration + CLOCK_SKEW_SECONDS;

                    Disposable disposable = scheduleSessionRemoveJob(session, path, sub, debugPath, effectiveSeconds);
                    processSessionClosedEvent(session, path, sub, disposable);
                    return defaultWebSocketHandler.handle(session);
                } catch (Exception e) {
                    log.warn(LOG_PREFIX + "JWT expiration read failed, closing: {}", sessionId, path, sub, e.getMessage());
                    sessionRegistry.remove(sessionId);
                    return session.close();
                }
            });
        } else {
            return defaultWebSocketService.handleRequest(exchange, defaultWebSocketHandler);
        }
    }

    /* TODO: avoid hardcoded paths.
        Relay on spring security to verify that endpoint is available with token or no token.
        Then if request have token, we should run session remove job etc.
    */
    private boolean isSecuredEndpoint(String path) {
        return Set.of(TOOLS_API_WS_ENDPOINT_PREFIX, TOOLS_AGENT_WS_ENDPOINT_PREFIX, NATS_WS_ENDPOINT_PATH, NATS_API_WS_ENDPOINT_PATH)
                .stream()
                .anyMatch(path::startsWith);
    }

    private Disposable scheduleSessionRemoveJob(WebSocketSession session, String path, String sub, boolean debugPath, long secondsUntilExpiration) {
        String sessionId = session.getId();
        if (debugPath) {
            log.info(LOG_PREFIX + "scheduling session remove job in {}s", sessionId, path, sub, secondsUntilExpiration);
        }
        return Mono.delay(Duration.ofSeconds(secondsUntilExpiration))
                .flatMap(__ -> {
                    if (debugPath) {
                        log.info(LOG_PREFIX + "executing session remove job (JWT expiry)", sessionId, path, sub);
                    }
                    return session.close()
                            .doOnSuccess(___ -> {
                                if (debugPath) {
                                    log.info(LOG_PREFIX + "closed by session remove job", sessionId, path, sub);
                                }
                            })
                            .doOnError(ex -> log.error(LOG_PREFIX + "session remove job close failed: {}", sessionId, path, sub, ex.getMessage(), ex));
                })
                .subscribe(
                        null,
                        ex -> log.error(LOG_PREFIX + "session remove job failed", sessionId, path, sub, ex),
                        () -> { }
                );
    }

    private void processSessionClosedEvent(WebSocketSession session, String path, String sub, Disposable disposable) {
        String sessionId = session.getId();
        session.closeStatus()
                .subscribe(
                        status -> {
                            SessionInfo info = sessionRegistry.remove(sessionId);
                            long lifetimeSec = info != null
                                    ? Duration.between(info.createdAt(), Instant.now()).getSeconds()
                                    : -1;
                            String logSub = info != null ? info.sub() : sub;
                            if (loggingProperties.isDebugPath(path)) {
                                log.info(LOG_PREFIX + "session closed code={} reason={} lifetimeSec={}",
                                        sessionId, path, logSub, status.getCode(), status.getReason(), lifetimeSec);
                            } else {
                                log.info(LOG_PREFIX + "session closed code={} reason={}",
                                        sessionId, path, logSub, status.getCode(), status.getReason());
                            }
                            disposable.dispose();
                        },
                        ex -> {
                            log.warn(LOG_PREFIX + "closeStatus observation error: {}", sessionId, path, sub, ex.getMessage());
                            disposable.dispose();
                        }
                );
    }
}
