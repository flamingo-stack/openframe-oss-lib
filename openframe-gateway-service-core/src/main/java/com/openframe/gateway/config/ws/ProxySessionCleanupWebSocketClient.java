package com.openframe.gateway.config.ws;

import com.openframe.gateway.tenant.TenantRoutingHeaders;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.reactive.socket.client.WebSocketClient;
import reactor.core.publisher.Mono;
import reactor.core.publisher.SignalType;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

@RequiredArgsConstructor
@Slf4j
public class ProxySessionCleanupWebSocketClient implements WebSocketClient {

    private static final String LOG_PREFIX = "Debug ws proxy sessionId={} path={} | ";
    private static final Duration CLOSE_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration CLEANUP_GRACE = Duration.ofSeconds(2);

    private final WebSocketClient delegate;
    private final WebSocketLoggingProperties loggingProperties;
    private final boolean cleanupEnabled;

    @Override
    public Mono<Void> execute(URI url, WebSocketHandler handler) {
        AtomicBoolean relayStarted = new AtomicBoolean(false);
        return decorateConnection(url, null, relayStarted,
                delegate.execute(url, wrapHandler(url, handler, relayStarted)));
    }

    @Override
    public Mono<Void> execute(URI url, HttpHeaders headers, WebSocketHandler handler) {
        AtomicBoolean relayStarted = new AtomicBoolean(false);
        String tenant = headers != null ? headers.getFirst(TenantRoutingHeaders.TENANT_ID_HEADER) : null;
        return decorateConnection(url, tenant, relayStarted,
                delegate.execute(url, headers, wrapHandler(url, handler, relayStarted)));
    }

    // Upstream connect/finish/failure logging. `sub` (agent id) comes from the authenticated security
    // context and lets an abort/relay line be joined to the client-side "session closed" line.
    // `relayStarted` distinguishes the expected post-relay teardown race (DEBUG) from a genuine
    // connect/handshake failure (WARN).
    private Mono<Void> decorateConnection(URI url, String tenant, AtomicBoolean relayStarted, Mono<Void> connection) {
        if (!loggingProperties.isFramePayloadLoggingEnabled()) {
            return connection;
        }
        String tnt = tenant == null ? "-" : tenant;
        return authenticatedSub().flatMap(sb -> connection
                .doOnSubscribe(s -> log.debug("Debug ws upstream connecting url={} tenant={} sub={}", url, tnt, sb))
                .doOnError(e -> {
                    if (relayStarted.get() && isPeerClosed(e)) {
                        log.debug("Debug ws upstream relay ended (peer closed) url={} tenant={} sub={} : {}",
                                url, tnt, sb, e.toString());
                    } else {
                        log.warn("Debug ws upstream connection FAILED url={} tenant={} sub={} : {}",
                                url, tnt, sb, e.toString(), e);
                    }
                })
                .doOnSuccess(v -> log.debug("Debug ws upstream relay finished url={} tenant={} sub={}", url, tnt, sb)));
    }

    /** Principal name from the request's security context; equals the JWT {@code sub} claim
     *  (see {@code setPrincipalClaimName("sub")} in GatewaySecurityConfig). {@code "-"} if absent. */
    private static Mono<String> authenticatedSub() {
        return ReactiveSecurityContextHolder.getContext()
                .mapNotNull(SecurityContext::getAuthentication)
                .map(Authentication::getName)
                .defaultIfEmpty("-")
                .onErrorReturn("-");
    }

    /** True when the throwable looks like the peer having already closed the connection. Only decisive
     *  once relay has started (see {@link #decorateConnection}); the same signature before relay starts is
     *  treated as a genuine connect/handshake failure and logged at WARN. */
    static boolean isPeerClosed(Throwable e) {
        String m = String.valueOf(e);
        return m.contains("AbortedException")
                || m.contains("Connection has been closed")
                || m.contains("Connection reset")
                || m.contains("prematurely closed");
    }

    private WebSocketHandler wrapHandler(URI targetUrl, WebSocketHandler handler, AtomicBoolean relayStarted) {
        String target = targetUrl.getPath();
        boolean debugPath = loggingProperties.isDebugPath(target);

        return new WebSocketHandler() {
            @Override
            public List<String> getSubProtocols() {
                return handler.getSubProtocols();
            }

            @Override
            public Mono<Void> handle(WebSocketSession proxySession) {
                // Upstream WS established: relay is starting. From here a peer-closed abort is the
                // expected teardown race (DEBUG), not a connect/handshake failure (WARN).
                relayStarted.set(true);
                String sessionId = proxySession.getId();
                if (debugPath) {
                    log.debug(LOG_PREFIX + "downstream proxy session opened", sessionId, target);
                }
                return handler.handle(proxySession)
                        .doFinally(signal -> {
                            if (!cleanupEnabled) {
                                return;
                            }
                            closeIfLeaked(proxySession, sessionId, target, debugPath, signal, CLEANUP_GRACE)
                                    .onErrorResume(ex -> Mono.empty())
                                    .subscribe(null,
                                            ex -> log.error(LOG_PREFIX + "failed to close: {}",
                                                    sessionId, target, ex.getMessage()));
                        });
            }
        };
    }

    /**
     * Force-closes the upstream proxy session only if it is genuinely leaked: races the session's own
     * {@link WebSocketSession#closeStatus() close signal} against a grace timer, so a normal teardown
     * in flight always wins and no second close frame is ever sent (the source of the
     * "Failed to release … CloseWebSocketFrame" double-release).
     */
    static Mono<Void> closeIfLeaked(WebSocketSession proxySession, String sessionId, String target,
                                    boolean debugPath, SignalType signal, Duration grace) {
        if (!proxySession.isOpen()) {
            if (debugPath) {
                log.debug(LOG_PREFIX + "relay completed, already closed (signal={})", sessionId, target, signal);
            }
            return Mono.empty();
        }

        Mono<Void> naturalClose = proxySession.closeStatus()
                .then()
                .doOnSuccess(status -> {
                    if (debugPath) {
                        log.debug(LOG_PREFIX + "closed naturally within grace (signal={})", sessionId, target, signal);
                    }
                });

        Mono<Void> forceCloseAfterGrace = Mono.delay(grace)
                .filter(tick -> proxySession.isOpen())
                .flatMap(tick -> {
                    log.debug(LOG_PREFIX + "still open {}ms after relay (signal={}), force-closing leaked session",
                            sessionId, target, grace.toMillis(), signal);
                    return proxySession.close(CloseStatus.GOING_AWAY).timeout(CLOSE_TIMEOUT);
                });

        return Mono.firstWithSignal(naturalClose, forceCloseAfterGrace);
    }
}
