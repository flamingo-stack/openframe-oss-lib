package com.openframe.gateway.service;

import com.openframe.core.fleet.FleetEndpointMatcher;
import com.openframe.gateway.config.prop.FleetMultiTenancyProperties;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

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
 * Entries are {@code "METHOD pattern"} in Spring {@code PathPattern} syntax, matched against the path
 * <em>after</em> {@code /tools/fleetmdm-server}. Only the browser plane ({@code proxyApiRequest}) is
 * checked; the agent plane uses a separate proxy method and is never filtered here.
 */
@Component
public class FleetEndpointAllowlist {

    static final String FLEET_TOOL_ID = FleetEndpointMatcher.FLEET_TOOL_ID;

    private final boolean multiTenancyEnabled;
    private final FleetEndpointMatcher fleetEndpoints;

    public FleetEndpointAllowlist(FleetMultiTenancyProperties properties) {
        List<String> sharedEndpoints = properties.getAllowedEndpoints();
        List<String> extraEndpoints = properties.getExtraAllowedEndpoints();
        List<String> configuredEndpoints = Stream.of(sharedEndpoints, extraEndpoints)
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .toList();
        this.multiTenancyEnabled = properties.isEnabled();
        this.fleetEndpoints = new FleetEndpointMatcher(configuredEndpoints);
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
        return fleetEndpoints.matches(method, path);
    }
}
