package com.openframe.gateway.config.ws;

import tools.jackson.databind.ObjectMapper;
import com.openframe.gateway.config.ws.nats.session.NatsSubjectFilter;
import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import com.openframe.gateway.metrics.WebSocketKind;
import com.openframe.gateway.tenant.TenantRoutingHeaders;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.reactive.socket.server.WebSocketService;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.Disposable;
import reactor.core.Disposables;
import reactor.core.publisher.Mono;
import reactor.util.context.ContextView;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import static com.openframe.gateway.config.ws.WebSocketGatewayConfig.*;

@RequiredArgsConstructor
@Slf4j
public class WebSocketServiceSecurityDecorator implements WebSocketService {

    private static final String LOG_PREFIX = "Debug ws sessionId={} path={} sub={} | ";

    public static final long CLOCK_SKEW_SECONDS = 60; // align with Spring Security default skew

    private static final String RELAY_ENDPOINT = "/meshrelay.ashx";

    private final WebSocketService defaultWebSocketService;
    private final RequestJwtClaimsReader requestJwtReader;
    private final GatewayTrafficMetrics gatewayTrafficMetrics;
    private final WebSocketLoggingProperties loggingProperties;
    private final MeshControlCommandProperties meshControlProperties;
    private final ObjectMapper objectMapper;
    private final RelayAccessWatcher relayAccessWatcher;
    private final RemoteSessionCapProperties remoteSessionCapProperties;
    private final NatsSubjectFilter natsSubjectFilter;

    private final ConcurrentMap<String, SessionInfo> sessionRegistry = new ConcurrentHashMap<>();
    private record SessionInfo(Instant createdAt, String path, String sub) {}

    @Override
    public Mono<Void> handleRequest(ServerWebExchange exchange, WebSocketHandler defaultWebSocketHandler) {
        String path = exchange.getRequest().getPath().value();

        if (isSecuredEndpoint(path)) {
            return defaultWebSocketService.handleRequest(exchange, session -> Mono.deferContextual(context ->
                    handleSecuredSession(exchange, session, path, defaultWebSocketHandler, context)));
        } else {
            return defaultWebSocketService.handleRequest(exchange, defaultWebSocketHandler);
        }
    }

    private Mono<Void> handleSecuredSession(ServerWebExchange exchange, WebSocketSession session, String path,
                                            WebSocketHandler defaultWebSocketHandler, ContextView context) {
        String sessionId = session.getId();
        String sub = requestJwtReader.getSubject(exchange).orElse("-");
        boolean debugPath = loggingProperties.isDebugPath(path);

        sessionRegistry.put(sessionId, new SessionInfo(Instant.now(), path, sub));
        SecuredWebSocket socket = new SecuredWebSocket(exchange, session, path, sub, debugPath);

        try {
            Instant expiresAt = requestJwtReader.getExpiration(exchange);
            WebSocketKind kind = isRelayPath(path) ? WebSocketKind.RELAY : WebSocketKind.CHANNEL;

            gatewayTrafficMetrics.webSocketOpened(sessionId, path, sub);
            Disposable disposable = kind == WebSocketKind.RELAY
                    ? guardRelay(socket, expiresAt, context)
                    : scheduleExpiryClose(socket, expiresAt);
            processSessionClosedEvent(session, path, sub, kind, disposable);

            WebSocketSession sessionToHandle = session;
            // Command allowlist first, so the logging tap (when on) records what actually
            // reaches the tool rather than what the browser attempted.
            if (meshControlProperties.isEnabled() && meshControlProperties.isControlPath(path)) {
                sessionToHandle = new MeshControlFilteringWebSocketSessionDecorator(
                        sessionToHandle, path, tenantId(exchange), meshControlProperties, objectMapper);
            }
            if (natsSubjectFilter.isEnabledFor(exchange)) {
                sessionToHandle = natsSubjectFilter.decorate(exchange, sessionToHandle, path, tenantId(exchange), context);
            }
            if (loggingProperties.isFramePath(path)) {
                sessionToHandle = new LoggingWebSocketSessionDecorator(
                        sessionToHandle, path, tenantId(exchange), loggingProperties);
            }
            return defaultWebSocketHandler.handle(sessionToHandle);
        } catch (Exception e) {
            log.warn(LOG_PREFIX + "WebSocket session setup failed, closing", sessionId, path, sub, e);
            sessionRegistry.remove(sessionId);
            return session.close();
        }
    }

    private Disposable guardRelay(SecuredWebSocket socket, Instant expiresAt, ContextView context) {
        if (socket.isDebugPath()) {
            log.debug(LOG_PREFIX + "relay session opened, closing at the remote session cap",
                    socket.getSessionId(), socket.getPath(), socket.getSub());
        }
        long capSeconds = remoteSessionCapProperties.getMaxDurationSeconds();
        Disposable capClose = scheduleSessionRemoveJob(socket, capSeconds, CloseReason.SESSION_CAP);
        Disposable deviceWatch = watchRelayDevice(socket, expiresAt, context);
        return Disposables.composite(capClose, deviceWatch);
    }

    private Disposable watchRelayDevice(SecuredWebSocket socket, Instant expiresAt, ContextView context) {
        Instant firstCheckAt = expiresAt.plusSeconds(CLOCK_SKEW_SECONDS);
        return requestJwtReader.getMachineId(socket.getExchange())
                .map(machineId -> relayDevice(socket, machineId))
                .map(device -> relayAccessWatcher.watch(socket.getSession(), device, firstCheckAt, context))
                .orElseGet(Disposables::disposed);
    }

    private static RelayDevice relayDevice(SecuredWebSocket socket, String machineId) {
        String tenantId = tenantId(socket.getExchange());
        return new RelayDevice(tenantId, machineId);
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

    public static boolean isRelayPath(String path) {
        if (path == null || !path.startsWith(TOOLS_API_WS_ENDPOINT_PREFIX + "/")) {
            return false;
        }
        String endpoint = StringUtils.stripEnd(path, "/").toLowerCase(Locale.ROOT);
        return endpoint.endsWith(RELAY_ENDPOINT);
    }

    private Disposable scheduleExpiryClose(SecuredWebSocket socket, Instant expiresAt) {
        if (socket.isDebugPath()) {
            log.debug(LOG_PREFIX + "session opened, scheduling JWT expiry close",
                    socket.getSessionId(), socket.getPath(), socket.getSub());
        }
        long secondsUntilExpiration = Duration.between(Instant.now(), expiresAt).getSeconds();
        long effectiveSeconds = secondsUntilExpiration + CLOCK_SKEW_SECONDS;
        return scheduleSessionRemoveJob(socket, effectiveSeconds, CloseReason.JWT_EXPIRY);
    }

    private static String tenantId(ServerWebExchange exchange) {
        return exchange.getRequest().getHeaders().getFirst(TenantRoutingHeaders.TENANT_ID_HEADER);
    }

    private Disposable scheduleSessionRemoveJob(SecuredWebSocket socket, long delaySeconds, CloseReason reason) {
        WebSocketSession session = socket.getSession();
        String sessionId = socket.getSessionId();
        String path = socket.getPath();
        String sub = socket.getSub();
        boolean debugPath = socket.isDebugPath();
        if (debugPath) {
            log.debug(LOG_PREFIX + "scheduling session remove job ({}) in {}s",
                    sessionId, path, sub, reason.getLabel(), delaySeconds);
        }
        return Mono.delay(Duration.ofSeconds(delaySeconds))
                .flatMap(__ -> {
                    if (debugPath) {
                        log.debug(LOG_PREFIX + "executing session remove job ({})", sessionId, path, sub, reason.getLabel());
                    }
                    return session.close()
                            .doOnSuccess(___ -> {
                                if (debugPath) {
                                    log.debug(LOG_PREFIX + "closed by session remove job", sessionId, path, sub);
                                }
                            })
                            .doOnError(ex -> log.error(LOG_PREFIX + "session remove job close failed", sessionId, path, sub, ex));
                })
                .subscribe(
                        null,
                        ex -> log.error(LOG_PREFIX + "session remove job failed", sessionId, path, sub, ex),
                        () -> { }
                );
    }

    private void processSessionClosedEvent(WebSocketSession session, String path, String sub, WebSocketKind kind,
                                           Disposable disposable) {
        String sessionId = session.getId();
        session.closeStatus()
                .subscribe(
                        status -> {
                            SessionInfo info = sessionRegistry.remove(sessionId);
                            long lifetimeSec = info != null
                                    ? Duration.between(info.createdAt(), Instant.now()).getSeconds()
                                    : -1;
                            String logSub = info != null ? info.sub() : sub;
                            gatewayTrafficMetrics.webSocketClosed(sessionId, path, logSub);
                            String tool = toolFromPath(path);
                            gatewayTrafficMetrics.recordSessionClosed(tool, kind, status.getCode(), lifetimeSec);
                            if (loggingProperties.isDebugPath(path)) {
                                log.debug(LOG_PREFIX + "session closed code={} reason={} lifetime={}",
                                        sessionId, path, logSub, status.getCode(), status.getReason(), formatLifetime(lifetimeSec));
                            } else {
                                log.debug(LOG_PREFIX + "session closed code={} reason={}",
                                        sessionId, path, logSub, status.getCode(), status.getReason());
                            }
                            if (loggingProperties.isDebugPath(path)) {
                                log.debug(LOG_PREFIX + "disposed session remove job (client closed first)", sessionId, path, logSub);
                            }
                            disposable.dispose();
                        },
                        ex -> {
                            log.warn(LOG_PREFIX + "closeStatus observation error", sessionId, path, sub, ex);
                            disposable.dispose();
                        }
                );
    }

    /** Low-cardinality tool label for metrics: meshcentral-server / nats / nats-api / other. */
    public static String toolFromPath(String path) {
        if (path == null) {
            return "unknown";
        }
        String[] p = path.split("/");
        if (path.startsWith(TOOLS_AGENT_WS_ENDPOINT_PREFIX + "/") && p.length > 4) {
            return p[4];   // /ws/tools/agent/{tool}/...
        }
        if (path.startsWith(TOOLS_API_WS_ENDPOINT_PREFIX + "/") && p.length > 3) {
            return p[3];   // /ws/tools/{tool}/...
        }
        if (path.startsWith(NATS_API_WS_ENDPOINT_PATH)) {
            return "nats-api";
        }
        if (path.startsWith(NATS_WS_ENDPOINT_PATH)) {
            return "nats";
        }
        return "other";
    }

    private static String formatLifetime(long totalSeconds) {
        if (totalSeconds < 0) {
            return "-";
        }
        if (totalSeconds < 60) {
            return totalSeconds + " sec";
        }
        long min = totalSeconds / 60;
        long sec = totalSeconds % 60;
        return sec == 0 ? min + " min" : min + " min " + sec + " sec";
    }
}
