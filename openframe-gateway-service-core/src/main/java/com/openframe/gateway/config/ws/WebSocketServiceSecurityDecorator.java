package com.openframe.gateway.config.ws;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.reactive.socket.adapter.ReactorNettyWebSocketSessionCloser;
import org.springframework.web.reactive.socket.server.WebSocketService;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.Disposable;
import reactor.core.publisher.Mono;
import reactor.core.publisher.SignalType;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import static com.openframe.gateway.config.ws.WebSocketGatewayConfig.*;

@RequiredArgsConstructor
@Slf4j
public class WebSocketServiceSecurityDecorator implements WebSocketService {

    public static final long CLOCK_SKEW_SECONDS = 60; // align with Spring Security default skew

    /**
     * Delay before force-closing a server session after normal handler completion.
     * Gives Reactor Netty time to complete its own close handshake (sendCloseNow)
     * without our close call racing it and causing StacklessClosedChannelException.
     */
    private static final Duration CLOSE_DELAY = Duration.ofSeconds(2);

    private final WebSocketService defaultWebSocketService;
    private final RequestJwtClaimsReader requestJwtReader;
    private final ConcurrentMap<String, SessionInfo> sessionRegistry = new ConcurrentHashMap<>();

    private record SessionInfo(Instant createdAt, String path) {}

    @Override
    public Mono<Void> handleRequest(ServerWebExchange exchange, WebSocketHandler defaultWebSocketHandler) {
        String path = exchange.getRequest().getPath().value();

        if (isSecuredEndpoint(path)) {
            return defaultWebSocketService.handleRequest(exchange, session -> {
                sessionRegistry.put(session.getId(), new SessionInfo(Instant.now(), path));

                Instant expiresAt;
                try {
                    expiresAt = requestJwtReader.getExpiration(exchange);
                } catch (Exception e) {
                    log.warn("Failed to read JWT expiration for session {}, closing: {}", session.getId(), e.getMessage());
                    sessionRegistry.remove(session.getId());
                    return ReactorNettyWebSocketSessionCloser.closeGracefully(session, CloseStatus.POLICY_VIOLATION);
                }

                long secondsUntilExpiration = Duration.between(Instant.now(), expiresAt).getSeconds();

                // Account for clock skew (same tolerance as Spring Security JwtTimestampValidator)
                long effectiveSeconds = secondsUntilExpiration + CLOCK_SKEW_SECONDS;

                Disposable disposable = scheduleSessionRemoveJob(session, effectiveSeconds);
                processSessionClosedEvent(session, path);
                return defaultWebSocketHandler.handle(session)
                        .doFinally(signal -> {
                            SessionInfo info = sessionRegistry.remove(session.getId());
                            long lifetimeMs = info != null
                                    ? Duration.between(info.createdAt(), Instant.now()).toMillis()
                                    : -1;
                            log.info("Session {} handler completed | path={} | signal={} | lifetime={}ms",
                                    session.getId(), path, signal, lifetimeMs);
                            if (session.isOpen()) {
                                if (signal == SignalType.ON_COMPLETE) {
                                    // On normal completion, delay our close to avoid racing with
                                    // Reactor Netty's internal close handshake (sendCloseNow),
                                    // which causes StacklessClosedChannelException and onErrorDropped.
                                    // The delay still acts as a safety net if Netty doesn't close.
                                    Mono.delay(CLOSE_DELAY)
                                            .subscribe(
                                                    __ -> {
                                                        if (session.isOpen()) {
                                                            log.debug("Server session {} still open {}ms after handler completed, closing",
                                                                    session.getId(), CLOSE_DELAY.toMillis());
                                                            ReactorNettyWebSocketSessionCloser.closeGracefully(session, CloseStatus.GOING_AWAY)
                                                                    .subscribe();
                                                        }
                                                    },
                                                    ex -> log.debug("Error in delayed server session close for {}: {}",
                                                            session.getId(), ex.getMessage())
                                            );
                                } else {
                                    log.warn("Server session {} still open after handler completed (signal={}), closing",
                                            session.getId(), signal);
                                    ReactorNettyWebSocketSessionCloser.closeGracefully(session, CloseStatus.GOING_AWAY)
                                            .subscribe();
                                }
                            }
                            disposable.dispose();
                        });
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

    private Disposable scheduleSessionRemoveJob(WebSocketSession session, long secondsUntilExpiration) {
        String sessionId = session.getId();
        log.info("Scheduling session remove job: {} - {} seconds", sessionId, secondsUntilExpiration);
        return Mono.delay(Duration.ofSeconds(secondsUntilExpiration))
                .flatMap(__ -> {
                    log.info("Executing session remove job: {}", sessionId);
                    return ReactorNettyWebSocketSessionCloser.closeGracefully(session, CloseStatus.GOING_AWAY)
                            .doOnSuccess(___ -> log.info("Closed session: {}", sessionId))
                            .doOnError(ex -> log.error("Failed to close session {}", sessionId, ex));
                })
                .subscribe();
    }

    private void processSessionClosedEvent(WebSocketSession session, String path) {
        session.closeStatus()
                .subscribe(
                        status -> log.info("Session {} close status | path={} | code={} | reason={}",
                                session.getId(), path, status.getCode(), status.getReason()),
                        ex -> log.debug("Error observing close status for session {}: {}",
                                session.getId(), ex.getMessage())
                );
    }
}
