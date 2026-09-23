package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.IntegratedToolId;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmClientProviderTest {

    private static final String FLEET_KEY = IntegratedToolId.FLEET_SERVER_ID.getValue();

    @Mock private IntegratedToolRepository integratedToolRepository;

    @InjectMocks private FleetMdmClientProvider provider;

    @Test
    void client_fleetToolMissing_throwsIllegalState() {
        // setup
        when(integratedToolRepository.findByKey(FLEET_KEY)).thenReturn(Optional.empty());

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> provider.client());

        // verifications
        assertThat(ex.getMessage()).contains(FLEET_KEY);
    }

    @Test
    void client_calledTwice_fleetToolLoadedOnceAndSameClientReturned() {
        // setup
        IntegratedTool fleetTool = fleetTool();
        when(integratedToolRepository.findByKey(FLEET_KEY)).thenReturn(Optional.of(fleetTool));

        // execution
        FleetMdmClient first = provider.client();
        FleetMdmClient second = provider.client();

        // verifications
        assertThat(second).isSameAs(first);
        verify(integratedToolRepository).findByKey(FLEET_KEY);
    }

    private static IntegratedTool fleetTool() {
        ToolApiKey apiKey = new ToolApiKey();
        apiKey.setKey("fleet-token");
        ToolCredentials credentials = new ToolCredentials();
        credentials.setApiKey(apiKey);
        ToolUrl apiUrl = ToolUrl.builder().url("http://fleet").type(ToolUrlType.API).build();
        IntegratedTool tool = new IntegratedTool();
        tool.setKey(FLEET_KEY);
        tool.setToolUrls(List.of(apiUrl));
        tool.setCredentials(credentials);
        return tool;
    }
}
