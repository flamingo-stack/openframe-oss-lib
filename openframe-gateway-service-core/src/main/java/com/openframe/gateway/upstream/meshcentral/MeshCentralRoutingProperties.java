package com.openframe.gateway.upstream.meshcentral;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Routing configuration for the meshcentral integrated tool.
 *
 * MeshCentral is a single service on one port, so the config is simple:
 * just an API upstream and a WebSocket upstream (typically the same host:port
 * since MeshCentral handles both HTTP and WebSocket on the same listener).
 *
 * Example:
 * <pre>
 * openframe:
 *   tools:
 *     meshcentral:
 *       api:
 *         url: http://meshcentral.integrated-tools.svc.cluster.local
 *         port: "8383"
 *       websocket:
 *         url: ws://meshcentral.integrated-tools.svc.cluster.local
 *         port: "8383"
 * </pre>
 */
@Data
@Component
@ConfigurationProperties(prefix = "openframe.tools.meshcentral")
public class MeshCentralRoutingProperties {

    /** MeshCentral HTTP endpoint. All REST traffic (API, dashboard, plugin routes) lands here. */
    private Upstream api;

    /** MeshCentral WebSocket endpoint. Handles control.ashx, meshrelay.ashx, agent.ashx. */
    private Upstream websocket;

    @Data
    public static class Upstream {
        private String url;
        private String port;
    }
}
