package com.openframe.gateway.upstream.tactical;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Routing configuration for the tactical-rmm integrated tool.
 *
 * Tactical-rmm is special because it used to sit behind {@code tactical-nginx},
 * which fanned a single hostname out to three different upstreams (Django backend,
 * Daphne websockets, NATS websocket) by path. With nginx removed, the gateway
 * needs to do that fan-out itself, which means it needs to know about all three
 * upstreams. They are configured here instead of in the {@code IntegratedTool}
 * Mongo document so that the routing is reviewable in version control and
 * deployed atomically with the gateway.
 *
 * Example:
 * <pre>
 * openframe:
 *   tools:
 *     tactical-rmm:
 *       backend:
 *         url: http://tactical-backend.integrated-tools.svc.cluster.local
 *         port: "8080"
 *       websocket:
 *         url: ws://tactical-backend.integrated-tools.svc.cluster.local
 *         port: "8383"
 *         path-prefix: /ws/
 *       nats:
 *         url: ws://tactical-nats.integrated-tools.svc.cluster.local
 *         port: "9235"
 *         path-prefix: /natsws
 * </pre>
 */
@Data
@Component
@ConfigurationProperties(prefix = "openframe.tools.tactical-rmm")
public class TacticalRmmRoutingProperties {

    /** Django backend (uWSGI http-socket). All REST traffic lands here. */
    private Upstream backend;

    /** Daphne ASGI server. Handles {@code /ws/} websocket traffic. */
    private Upstream websocket;

    /** NATS websocket listener. Handles {@code /natsws} traffic. */
    private Upstream nats;

    @Data
    public static class Upstream {
        private String url;
        private String port;
        /** Optional path-prefix marker, used by the WS resolver to fan out by path. */
        private String pathPrefix;
    }
}
