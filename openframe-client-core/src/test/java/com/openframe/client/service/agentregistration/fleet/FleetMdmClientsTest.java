package com.openframe.client.service.agentregistration.fleet;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmClientsTest {

    @Mock
    private IntegratedToolService integratedToolService;

    @Test
    void client_noFleetTool_throwsNamingTheTool() {
        // setup
        FleetMdmClients clients = new FleetMdmClients(integratedToolService);
        when(integratedToolService.getToolByKey("fleetmdm-server")).thenReturn(Optional.empty());

        // execution
        Throwable thrown = catchThrowable(clients::client);

        // verifications
        assertThat(thrown).isInstanceOf(IllegalStateException.class)
                .hasMessage("Found no tool with id fleetmdm-server");
    }

    @Test
    void client_fleetTool_builtFromItsApiUrlAndToken() {
        // setup
        FleetMdmClients clients = spy(new FleetMdmClients(integratedToolService));
        FleetMdmClient built = mock(FleetMdmClient.class);
        when(integratedToolService.getToolByKey("fleetmdm-server")).thenReturn(Optional.of(fleetTool()));
        doReturn(built).when(clients).createClient("http://fleet:8070", "fleet-token");

        // execution
        FleetMdmClient client = clients.client();

        // verifications
        assertThat(client).isSameAs(built);
    }

    @Test
    void validateTenantConfig_multiTenancyWithoutTenant_failsAtStartup() {
        // setup
        FleetMdmClients clients = new FleetMdmClients(integratedToolService);
        ReflectionTestUtils.setField(clients, "fleetMultiTenancyEnabled", true);
        ReflectionTestUtils.setField(clients, "tenantId", "");

        // execution
        Throwable thrown = catchThrowable(clients::validateTenantConfig);

        // verifications
        assertThat(thrown).isInstanceOf(IllegalStateException.class).hasMessage(
                "openframe.fleet.multi-tenancy.enabled=true but no tenant id is configured (TENANT_ID env var missing?)");
    }

    private static IntegratedTool fleetTool() {
        ToolApiKey apiKey = new ToolApiKey();
        apiKey.setKey("fleet-token");
        ToolCredentials credentials = new ToolCredentials();
        credentials.setApiKey(apiKey);
        ToolUrl api = ToolUrl.builder().url("http://fleet").port("8070").type(ToolUrlType.API).build();
        return IntegratedTool.builder().key("fleetmdm-server").toolUrls(List.of(api)).credentials(credentials).build();
    }
}
