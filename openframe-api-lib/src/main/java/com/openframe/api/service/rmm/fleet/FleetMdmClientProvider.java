package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.IntegratedToolId;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
@RequiredArgsConstructor
public class FleetMdmClientProvider {

    private final IntegratedToolRepository integratedToolRepository;
    private final TenantIdProvider tenantIdProvider;

    private volatile CachedClient cached;

    public FleetMdmClient client() {
        String key = IntegratedToolId.FLEET_SERVER_ID.getValue();
        IntegratedTool tool = integratedToolRepository.findByKey(key)
                .orElseThrow(() -> new IllegalStateException("Fleet MDM tool not configured: " + key));
        CachedClient current = cached;
        if (current == null || !current.isFor(tool)) {
            current = new CachedClient(tool.apiUrl(), tool.apiToken(),
                    new FleetMdmClient(tool.apiUrl(), tool.apiToken(), tenantIdProvider.getTenantId()));
            cached = current;
        }
        return current.client();
    }

    private record CachedClient(String apiUrl, String apiToken, FleetMdmClient client) {
        boolean isFor(IntegratedTool tool) {
            return Objects.equals(apiUrl, tool.apiUrl()) && Objects.equals(apiToken, tool.apiToken());
        }
    }
}
