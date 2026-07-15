package com.openframe.gateway.service;

import com.openframe.gateway.config.prop.FleetMultiTenancyProperties;
import org.springframework.http.HttpMethod;
import org.springframework.http.server.PathContainer;
import org.springframework.stereotype.Component;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Global endpoint allowlist for the Fleet MDM browser proxy ({@code /tools/fleetmdm-server/**}).
 *
 * <p>Under shared multi-tenancy the tenant UI reaches Fleet through a raw pass-through proxy,
 * authenticated as the tenant's Fleet global-admin token — so a browser could call any of Fleet's
 * ~188 REST endpoints, far more than the ~30 the UI actually uses. This allowlist restricts the
 * proxy to a configured set, blocking everything else with 403. It is defense in depth over Fleet's
 * own datastore tenant fences.
 *
 * <p><b>Scope and gating (deliberately narrow):</b>
 * <ul>
 *   <li>Applies to <b>only</b> {@code fleetmdm-server}. Every other tool proxies unfiltered.</li>
 *   <li>Active <b>only</b> when {@code openframe.fleet.multi-tenancy.enabled=true}. Off ⇒ no
 *       filtering at all.</li>
 * </ul>
 *
 * <p>The allowed set is <b>gateway-global configuration</b> (not per-tenant): every tenant runs the
 * identical Fleet UI, so the list is one value on the shared gateway
 * ({@code openframe.fleet.multi-tenancy.allowed-endpoints}, see {@link FleetMultiTenancyProperties}).
 * Entries are {@code "METHOD pattern"} in Spring {@link PathPattern} syntax, matched against the path
 * <em>after</em> {@code /tools/fleetmdm-server}. Only the browser plane ({@code proxyApiRequest}) is
 * checked; the agent plane uses a separate proxy method and is never filtered here.
 */
@Component
public class FleetEndpointAllowlist {

    static final String FLEET_TOOL_ID = "fleetmdm-server";

    private final boolean multiTenancyEnabled;
    private final Map<HttpMethod, List<PathPattern>> fleetPatterns;

    public FleetEndpointAllowlist(FleetMultiTenancyProperties properties) {
        this.multiTenancyEnabled = properties.isEnabled();
        this.fleetPatterns = compile(properties.getAllowedEndpoints());
    }

    /**
     * @return true if the browser proxy may forward this request. Always true unless multi-tenancy
     * is enabled and the tool is {@code fleetmdm-server}, in which case only the configured
     * method+path combinations pass.
     */
    public boolean isAllowed(String toolId, HttpMethod method, String path) {
        if (!multiTenancyEnabled || !FLEET_TOOL_ID.equals(toolId)) {
            return true;
        }
        List<PathPattern> patterns = fleetPatterns.get(method);
        if (patterns == null) {
            return false;
        }
        PathContainer container = PathContainer.parsePath(path);
        for (PathPattern pattern : patterns) {
            if (pattern.matches(container)) {
                return true;
            }
        }
        return false;
    }

    private static Map<HttpMethod, List<PathPattern>> compile(List<String> entries) {
        PathPatternParser parser = new PathPatternParser();
        Map<HttpMethod, List<PathPattern>> byMethod = new HashMap<>();
        if (entries == null) {
            return byMethod;
        }
        for (String entry : entries) {
            String[] parts = entry.trim().split("\\s+", 2);
            if (parts.length != 2) {
                throw new IllegalArgumentException("Invalid allowlist entry (expected \"METHOD pattern\"): " + entry);
            }
            HttpMethod method = HttpMethod.valueOf(parts[0].toUpperCase());
            byMethod.computeIfAbsent(method, m -> new ArrayList<>()).add(parser.parse(parts[1]));
        }
        return byMethod;
    }
}
