package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.IntegratedToolId;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.FleetTenantHeader;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class FleetMdmClientProvider {

    private final IntegratedToolRepository integratedToolRepository;

    @Value("${TENANT_ID:}")
    private String tenantIdEnv;

    @Value("${openframe.fleet.multi-tenancy.enabled}")
    private boolean fleetMultiTenancyEnabled;

    private FleetMdmClient client;

    public FleetMdmClient client() {
        FleetMdmClient current = client;
        if (current == null) {
            current = createClient();
            client = current;
        }
        return current;
    }

    private FleetMdmClient createClient() {
        FleetTenantHeader.validate(fleetMultiTenancyEnabled, tenantIdEnv);
        String key = IntegratedToolId.FLEET_SERVER_ID.getValue();
        IntegratedTool tool = integratedToolRepository.findByKey(key)
                .orElseThrow(() -> new IllegalStateException("Fleet MDM tool not configured: " + key));
        return new FleetMdmClient(tool.apiUrl(), tool.apiToken(), tenantIdEnv);
    }
}
