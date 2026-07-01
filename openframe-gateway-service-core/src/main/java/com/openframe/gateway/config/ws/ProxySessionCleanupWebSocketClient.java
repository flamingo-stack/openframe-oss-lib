package com.openframe.gateway.config.ws;

import com.openframe.gateway.tenant.TenantRoutingHeaders;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
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
import java.util.concurrent.atomic.AtomicBoolean;

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
        AtomicBoolean relayStarted = new AtomicBoolean(false);
        return decorateConnection(url, null, subFrom(url, null), relayStarted,
                delegate.execute(url, wrapHandler(url, handler, relayStarted)));
    }

    @Override
    public Mono<Void> execute(URI url, HttpHeaders headers, WebSocketHandler handler) {
        AtomicBoolean relayStarted = new AtomicBoolean(false);
        String tenant = headers != null ? headers.getFirst(TenantRoutingHeaders.TENANT_ID_HEADER) : null;
        String sub = subFrom(url, headers);
        return decorateConnection(url, tenant, sub, relayStarted,
                delegate.execute(url, headers, wrapHandler(url, handler, relayStarted)));
    }

    // Upstream connect/finish/failure logging. Gated by the global frame-logging switch rather than a
    // path prefix: this runs at the WebSocketClient level where the URL is the rewritten upstream
    // address, so per-path scoping is not meaningful here (frame logging itself is scoped on the
    // original request path in WebSocketServiceSecurityDecorator). `sub` (agent machine id) is included
    // so an abort/relay line can be joined by agent to the client-side "session closed code=…" line.
    // `relayStarted` flips true once the upstream WS is established (handler.handle invoked): only then is
    // a peer-closed abort the expected teardown race (DEBUG). The same error BEFORE relay starts is a
    // genuine connect/handshake failure and must stay WARN.
    private Mono<Void> decorateConnection(URI url, String tenant, String sub,
                                          AtomicBoolean relayStarted, Mono<Void> connection) {
        if (!loggingProperties.isFramePayloadLoggingEnabled()) {
            return connection;
        }
        String tnt = tenant == null ? "-" : tenant;
        String sb = sub == null ? "-" : sub;
        return connection
                .doOnSubscribe(s -> log.debug("Debug ws upstream connecting url={} tenant={} sub={}", url, tnt, sb))
                .doOnError(e -> {
                    if (relayStarted.get() && isPeerClosed(e)) {
                        // Expected teardown race: the upstream WS was relaying, then the peer (agent/tool)
                        // closed and an in-flight frame could not be delivered. Not a connect failure -> DEBUG.
                        log.debug("Debug ws upstream relay ended (peer closed) url={} tenant={} sub={} : {}",
                                url, tnt, sb, e.toString());
                    } else {
                        // Pre-relay (connect/handshake) failure, or an unexpected error -> real problem.
                        log.warn("Debug ws upstream connection FAILED url={} tenant={} sub={} : {}",
                                url, tnt, sb, e.toString(), e);
                    }
                })
                .doOnSuccess(v -> log.debug("Debug ws upstream relay finished url={} tenant={} sub={}", url, tnt, sb));
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

    /** Best-effort agent id (JWT {@code sub}) from the forwarded Authorization header, falling back to
     *  the {@code authorization} query param some tool routes carry. Claims are read WITHOUT verifying
     *  the signature — for logging/correlation only. Returns null if unavailable. */
    static String subFrom(URI url, HttpHeaders headers) {
        String token = bearerToken(headers);
        if (token == null) {
            token = queryAuthToken(url);
        }
        if (token == null) {
            return null;
        }
        try {
            String unsigned = token.substring(0, token.lastIndexOf('.') + 1);
            return claimSub(Jwts.parserBuilder().build().parseClaimsJwt(unsigned).getBody());
        } catch (ExpiredJwtException ex) {
            return claimSub(ex.getClaims());
        } catch (Exception e) {
            return null;
        }
    }

    private static String claimSub(Claims claims) {
        Object sub = claims == null ? null : claims.get("sub");
        return sub == null ? null : String.valueOf(sub);
    }

    private static String bearerToken(HttpHeaders headers) {
        if (headers == null) {
            return null;
        }
        String auth = headers.getFirst(HttpHeaders.AUTHORIZATION);
        return (auth != null && auth.startsWith("Bearer ")) ? auth.substring(7) : null;
    }

    private static String queryAuthToken(URI url) {
        String query = url == null ? null : url.getRawQuery();
        if (query == null) {
            return null;
        }
        for (String kv : query.split("&")) {
            if (kv.startsWith("authorization=")) {
                return kv.substring("authorization=".length());
            }
        }
        return null;
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
