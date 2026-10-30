package com.openframe.client.service.agentregistration.fleet;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.IntegratedToolId;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.FleetTenantHeader;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

// Turns the integrated Fleet tool into a client in one place: the agent-id transformer and the host facts backfill
// talk to the same Fleet with the same tenant header.
@Component
@RequiredArgsConstructor
public class FleetMdmClients {

    private final IntegratedToolService integratedToolService;

    @Value("${TENANT_ID:}")
    private String tenantId;

    @Value("${openframe.fleet.multi-tenancy.enabled:false}")
    private boolean fleetMultiTenancyEnabled;

    @PostConstruct
    void validateTenantConfig() {
        FleetTenantHeader.validate(fleetMultiTenancyEnabled, tenantId);
    }

    public FleetMdmClient client() {
        String toolId = IntegratedToolId.FLEET_SERVER_ID.getValue();
        IntegratedTool tool = integratedToolService.getToolByKey(toolId)
                .orElseThrow(() -> new IllegalStateException("Found no tool with id " + toolId));
        String apiUrl = tool.apiUrl();
        String apiToken = tool.apiToken();
        return createClient(apiUrl, apiToken);
    }

    protected FleetMdmClient createClient(String apiUrl, String apiToken) {
        return new FleetMdmClient(apiUrl, apiToken, tenantId);
    }
}
