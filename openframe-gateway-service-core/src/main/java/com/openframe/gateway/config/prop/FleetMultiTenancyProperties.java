package com.openframe.gateway.config.prop;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Configuration for OpenFrame Fleet MDM multi-tenancy at the gateway.
 *
 * <p>Bound from {@code openframe.fleet.multi-tenancy.*} — the same platform switch that enables
 * Fleet's shared-DB multi-tenancy. When {@code enabled} is true, the Fleet browser proxy
 * ({@code /tools/fleetmdm-server/**}) is restricted to {@code allowedEndpoints}; every other tool and
 * the disabled state are unaffected.
 *
 * <pre>
 * openframe:
 *   fleet:
 *     multi-tenancy:
 *       enabled: true
 *       allowed-endpoints:
 *         - "GET /api/{v}/fleet/hosts"
 *         - "DELETE /api/{v}/fleet/labels/id/{id}"
 *       upstream:
 *         api:
 *           url: http://fleet.fleet-shared.svc.cluster.local
 *           port: "8080"
 *         websocket:
 *           url: ws://fleet.fleet-shared.svc.cluster.local
 *           port: "8080"
 * </pre>
 */
@Data
@Component
@ConfigurationProperties(prefix = "openframe.fleet.multi-tenancy")
public class FleetMultiTenancyProperties {

    /**
     * Master switch for Fleet multi-tenancy behavior at the gateway (the endpoint allowlist and the
     * shared-Fleet upstream routing).
     */
    private boolean enabled = false;

    /**
     * Allowlisted Fleet endpoints for the browser proxy, each {@code "METHOD pattern"} in Spring
     * PathPattern syntax matched against the path after {@code /tools/fleetmdm-server}. Only consulted
     * when {@link #enabled} is true.
     */
    private List<String> allowedEndpoints = new ArrayList<>();

    private Upstream upstream = new Upstream();

    @Data
    public static class Upstream {
        private Endpoint api = new Endpoint();
        private Endpoint websocket = new Endpoint();
    }

    @Data
    public static class Endpoint {
        private String url;
        private String port;
    }

}
