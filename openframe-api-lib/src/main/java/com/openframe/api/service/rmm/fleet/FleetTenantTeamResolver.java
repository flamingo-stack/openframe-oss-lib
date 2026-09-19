package com.openframe.api.service.rmm.fleet;

import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class FleetTenantTeamResolver {

    private final FleetClientProvider fleet;
    private final TenantIdProvider tenantIdProvider;

    private final Map<String, Long> teamIdByTenant = new ConcurrentHashMap<>();

    public Optional<Long> currentTenantTeamId() {
        String tenantId = tenantIdProvider.getTenantId();
        Long cached = teamIdByTenant.get(tenantId);
        if (cached != null) {
            return Optional.of(cached);
        }

        HostSearchRequest request = new HostSearchRequest();
        request.setPerPage(1);
        List<Host> hosts = fleet.call(client -> client.searchHosts(request), "resolve tenant Fleet team id");

        Optional<Long> teamId = hosts == null ? Optional.empty()
                : hosts.stream().map(Host::getTeamId).filter(Objects::nonNull).findFirst();
        teamId.ifPresent(id -> {
            teamIdByTenant.put(tenantId, id);
            log.debug("Resolved Fleet team id={} for tenant={}", id, tenantId);
        });
        if (teamId.isEmpty()) {
            log.warn("No Fleet team id resolvable for tenant={} (no enrolled hosts?) — inventory stays unscoped", tenantId);
        }
        return teamId;
    }
}
