package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmClientProviderTest {

    private static final String FLEET_KEY = "fleetmdm-server";

    @Mock private IntegratedToolRepository integratedToolRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks
    private FleetMdmClientProvider provider;

    @Test
    void client_sameTool_reusesTheClient() {
        // setup
        when(integratedToolRepository.findByKey(FLEET_KEY)).thenReturn(Optional.of(fleetTool("token-1")));
        when(tenantIdProvider.getTenantId()).thenReturn("tenant-1");

        // execution
        FleetMdmClient first = provider.client();
        FleetMdmClient second = provider.client();

        // verifications
        assertThat(second).isSameAs(first);
    }

    @Test
    void client_rotatedToken_buildsANewClient() {
        // setup
        when(integratedToolRepository.findByKey(FLEET_KEY))
                .thenReturn(Optional.of(fleetTool("token-1")), Optional.of(fleetTool("token-2")));
        when(tenantIdProvider.getTenantId()).thenReturn("tenant-1");

        // execution
        FleetMdmClient beforeRotation = provider.client();
        FleetMdmClient afterRotation = provider.client();

        // verifications
        assertThat(afterRotation).isNotSameAs(beforeRotation);
    }

    @Test
    void client_fleetNotConfigured_fails() {
        // setup
        when(integratedToolRepository.findByKey(FLEET_KEY)).thenReturn(Optional.empty());

        // execution / verifications
        assertThatThrownBy(provider::client)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Fleet MDM tool not configured: " + FLEET_KEY);
    }

    private static IntegratedTool fleetTool(String token) {
        ToolApiKey apiKey = new ToolApiKey();
        apiKey.setKey(token);
        ToolCredentials credentials = new ToolCredentials();
        credentials.setApiKey(apiKey);
        ToolUrl api = ToolUrl.builder().url("http://fleet").port("8070").type(ToolUrlType.API).build();
        return IntegratedTool.builder().key(FLEET_KEY).toolUrls(List.of(api)).credentials(credentials).build();
    }
}
