package com.openframe.stream.handler.software;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.IntegratedToolId;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.HostSoftwareResponse;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import com.openframe.stream.service.FleetBaseUrlResolver;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Service
@Slf4j
public class FleetHostSoftwareCache {

    private static final int PER_PAGE = 100;
    private static final Duration TTL = Duration.ofMinutes(2);

    private final IntegratedToolRepository integratedToolRepository;
    private final FleetBaseUrlResolver fleetBaseUrlResolver;

    @Value("${fleet.mdm.base-url:}")
    private String baseUrl;

    private final Cache<String, List<HostSoftwareTitle>> cache = Caffeine.newBuilder()
            .expireAfterWrite(TTL)
            .build();

    public FleetHostSoftwareCache(IntegratedToolRepository integratedToolRepository,
                                  @Autowired(required = false) FleetBaseUrlResolver fleetBaseUrlResolver) {
        this.integratedToolRepository = integratedToolRepository;
        this.fleetBaseUrlResolver = fleetBaseUrlResolver;
    }

    // keyed by the source commit as well: one Fleet commit writes many host_software rows, and each row is an event
    public List<HostSoftwareTitle> hostSoftware(String tenantId, long hostId, long commitTs) {
        String key = tenantId + ":" + hostId + ":" + commitTs;
        return cache.get(key, k -> load(tenantId, hostId));
    }

    private List<HostSoftwareTitle> load(String tenantId, long hostId) {
        FleetMdmClient client = clientFor(tenantId);
        List<HostSoftwareTitle> titles = new ArrayList<>();
        int page = 0;
        HostSoftwareResponse response;
        do {
            response = client.listHostSoftware(hostId, page, PER_PAGE);
            if (response == null) {
                break;
            }
            if (response.getSoftware() != null) {
                titles.addAll(response.getSoftware());
            }
            page++;
        } while (hasNext(response));
        log.debug("[software-cdc] fetched {} software title(s) for Fleet host {} (tenant {})",
                titles.size(), hostId, tenantId);
        return titles;
    }

    private static boolean hasNext(HostSoftwareResponse response) {
        return response.getMeta() != null && Boolean.TRUE.equals(response.getMeta().getHasNextResults());
    }

    private FleetMdmClient clientFor(String tenantId) {
        String key = IntegratedToolId.FLEET_SERVER_ID.getValue();
        IntegratedTool tool = integratedToolRepository.findByTenantIdAndKey(tenantId, key)
                .orElseThrow(() -> new IllegalStateException(
                        "Fleet MDM tool not configured for tenant " + tenantId + ": " + key));
        return new FleetMdmClient(baseUrlFor(tenantId), tool.apiToken(), tenantId);
    }

    String baseUrlFor(String tenantId) {
        if (fleetBaseUrlResolver != null) {
            String resolved = fleetBaseUrlResolver.resolveBaseUrl(tenantId);
            if (isNotBlank(resolved)) {
                return resolved;
            }
            log.warn("[software-cdc] no per-tenant Fleet base URL for tenant {} — falling back to the static base url", tenantId);
        }
        return baseUrl;
    }
}
