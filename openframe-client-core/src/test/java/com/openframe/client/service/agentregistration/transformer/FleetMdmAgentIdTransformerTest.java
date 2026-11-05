package com.openframe.client.service.agentregistration.transformer;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.data.service.ToolUrlService;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.Host;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmAgentIdTransformerTest {

    private static final String TOOL_ID = "fleetmdm-server";
    private static final String MACHINE_ID = "machine-1";
    private static final String HARDWARE_UUID = "5C0B4A3E-1F2D-4E6A-9B8C-7D6E5F4A3B2C";
    private static final String OTHER_UUID = "0A1B2C3D-4E5F-4061-8273-8495A6B7C8D9";
    private static final String INSTANCE_ID = "6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b";
    private static final String OSQUERY_VERSION = "5.12.0";
    private static final String ENROLLED_JANUARY = "2026-01-01T00:00:00Z";
    private static final String ENROLLED_FEBRUARY = "2026-02-01T00:00:00Z";
    private static final String TRANSFORM_FAILED = "Failed to transform Fleet MDM agent tool ID";

    @Mock private IntegratedToolService integratedToolService;
    @Mock private ToolUrlService toolUrlService;
    @Mock private FleetMdmClient fleetClient;

    private FleetMdmAgentIdTransformer transformer;
    private IntegratedTool tool;
    private ToolUrl toolUrl;
    private String createdApiUrl;
    private String createdApiToken;

    @BeforeEach
    void setUp() {
        ToolApiKey apiKey = new ToolApiKey();
        apiKey.setKey("api-token");
        ToolCredentials credentials = new ToolCredentials();
        credentials.setApiKey(apiKey);
        tool = IntegratedTool.builder().key(TOOL_ID).credentials(credentials).build();
        toolUrl = ToolUrl.builder().url("http://fleet").port("8080").build();
        transformer = new FleetMdmAgentIdTransformer(integratedToolService, toolUrlService) {
            @Override
            protected FleetMdmClient createClient(String apiUrl, String apiToken) {
                createdApiUrl = apiUrl;
                createdApiToken = apiToken;
                return fleetClient;
            }
        };
    }

    @Test
    void transform_uuidMatch_returnsHostIdWithoutIdentifierLookup() {
        // setup
        stubTool();
        when(fleetClient.searchHosts(HARDWARE_UUID, 0, 2))
                .thenReturn(List.of(host(10L, HARDWARE_UUID, HARDWARE_UUID, OSQUERY_VERSION, ENROLLED_JANUARY)));

        // execution
        String result = transformer.transform(MACHINE_ID, HARDWARE_UUID, false);

        // verifications
        assertThat(result).isEqualTo("10");
        assertThat(createdApiUrl).isEqualTo("http://fleet:8080");
        assertThat(createdApiToken).isEqualTo("api-token");
        verify(fleetClient, never()).getHostByIdentifier(HARDWARE_UUID);
    }

    @Test
    void transform_uuidDuplicates_newestEnrolledWinsWithoutIdentifierLookup() {
        // setup
        stubTool();
        when(fleetClient.searchHosts(HARDWARE_UUID, 0, 2)).thenReturn(List.of(
                host(10L, HARDWARE_UUID, HARDWARE_UUID, OSQUERY_VERSION, ENROLLED_JANUARY),
                host(11L, HARDWARE_UUID, HARDWARE_UUID, OSQUERY_VERSION, ENROLLED_FEBRUARY)));

        // execution
        String result = transformer.transform(MACHINE_ID, HARDWARE_UUID, false);

        // verifications
        assertThat(result).isEqualTo("11");
        verify(fleetClient, never()).getHostByIdentifier(HARDWARE_UUID);
    }

    @Test
    void transform_uuidHostWithoutOsqueryVersion_identifierLookupMissesAndThrows() {
        // setup
        stubTool();
        when(fleetClient.searchHosts(HARDWARE_UUID, 0, 2))
                .thenReturn(List.of(host(10L, HARDWARE_UUID, HARDWARE_UUID, null, ENROLLED_JANUARY)));
        when(fleetClient.getHostByIdentifier(HARDWARE_UUID)).thenReturn(null);

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> transformer.transform(MACHINE_ID, HARDWARE_UUID, false));

        // verifications
        assertThat(ex.getMessage()).contains(TRANSFORM_FAILED);
    }

    @Test
    void transform_searchEmptyAndIdentifierMatchesOsqueryHostId_returnsHostId() {
        // setup
        stubTool();
        when(fleetClient.searchHosts(INSTANCE_ID, 0, 2)).thenReturn(List.of());
        when(fleetClient.getHostByIdentifier(INSTANCE_ID))
                .thenReturn(host(20L, HARDWARE_UUID, INSTANCE_ID, OSQUERY_VERSION, ENROLLED_JANUARY));

        // execution
        String result = transformer.transform(MACHINE_ID, INSTANCE_ID, false);

        // verifications
        assertThat(result).isEqualTo("20");
    }

    @Test
    void transform_searchReturnsOtherUuidsAndIdentifierMatches_returnsIdentifierHostId() {
        // setup
        stubTool();
        when(fleetClient.searchHosts(INSTANCE_ID, 0, 2))
                .thenReturn(List.of(host(5L, OTHER_UUID, OTHER_UUID, OSQUERY_VERSION, ENROLLED_JANUARY)));
        when(fleetClient.getHostByIdentifier(INSTANCE_ID))
                .thenReturn(host(20L, HARDWARE_UUID, INSTANCE_ID, OSQUERY_VERSION, ENROLLED_JANUARY));

        // execution
        String result = transformer.transform(MACHINE_ID, INSTANCE_ID, false);

        // verifications
        assertThat(result).isEqualTo("20");
    }

    @Test
    void transform_identifierOsqueryHostIdDiffersNotLastAttempt_throws() {
        // setup
        stubTool();
        when(fleetClient.searchHosts(INSTANCE_ID, 0, 2)).thenReturn(List.of());
        when(fleetClient.getHostByIdentifier(INSTANCE_ID))
                .thenReturn(host(30L, HARDWARE_UUID, OTHER_UUID, OSQUERY_VERSION, ENROLLED_JANUARY));

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> transformer.transform(MACHINE_ID, INSTANCE_ID, false));

        // verifications
        assertThat(ex.getMessage()).contains(TRANSFORM_FAILED);
    }

    @Test
    void transform_identifierOsqueryHostIdDiffersLastAttempt_returnsRawId() {
        // setup
        stubTool();
        when(fleetClient.searchHosts(INSTANCE_ID, 0, 2)).thenReturn(List.of());
        when(fleetClient.getHostByIdentifier(INSTANCE_ID))
                .thenReturn(host(30L, HARDWARE_UUID, OTHER_UUID, OSQUERY_VERSION, ENROLLED_JANUARY));

        // execution
        String result = transformer.transform(MACHINE_ID, INSTANCE_ID, true);

        // verifications
        assertThat(result).isEqualTo(INSTANCE_ID);
    }

    @Test
    void transform_identifierHostWithoutOsqueryVersionLastAttempt_returnsRawId() {
        // setup
        stubTool();
        when(fleetClient.searchHosts(INSTANCE_ID, 0, 2)).thenReturn(List.of());
        when(fleetClient.getHostByIdentifier(INSTANCE_ID))
                .thenReturn(host(20L, HARDWARE_UUID, INSTANCE_ID, null, ENROLLED_JANUARY));

        // execution
        String result = transformer.transform(MACHINE_ID, INSTANCE_ID, true);

        // verifications
        assertThat(result).isEqualTo(INSTANCE_ID);
    }

    @Test
    void transform_identifierNotFoundNotLastAttempt_throws() {
        // setup
        stubTool();
        when(fleetClient.searchHosts(INSTANCE_ID, 0, 2)).thenReturn(List.of());
        when(fleetClient.getHostByIdentifier(INSTANCE_ID)).thenReturn(null);

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> transformer.transform(MACHINE_ID, INSTANCE_ID, false));

        // verifications
        assertThat(ex.getMessage()).contains(TRANSFORM_FAILED);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void transform_blankAgentToolId_returnedUnchangedWithoutFleetCall(String agentToolId) {
        // setup

        // execution
        String result = transformer.transform(MACHINE_ID, agentToolId, false);

        // verifications
        assertThat(result).isEqualTo(agentToolId);
        verifyNoInteractions(integratedToolService, toolUrlService, fleetClient);
    }

    @Test
    void transform_toolMissing_throwsIllegalState() {
        // setup
        when(integratedToolService.getToolByKey(TOOL_ID)).thenReturn(Optional.empty());

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> transformer.transform(MACHINE_ID, HARDWARE_UUID, false));

        // verifications
        assertThat(ex.getMessage()).contains(TRANSFORM_FAILED);
        assertThat(ex.getCause().getMessage()).contains("Found no tool");
    }

    @Test
    void transform_apiUrlMissing_throwsIllegalState() {
        // setup
        when(integratedToolService.getToolByKey(TOOL_ID)).thenReturn(Optional.of(tool));
        when(toolUrlService.getUrlByToolType(tool, ToolUrlType.API)).thenReturn(Optional.empty());

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> transformer.transform(MACHINE_ID, HARDWARE_UUID, false));

        // verifications
        assertThat(ex.getMessage()).contains(TRANSFORM_FAILED);
        assertThat(ex.getCause().getMessage()).contains("Found no api url");
    }

    @Test
    void getToolType_returnsFleetMdm() {
        // setup

        // execution
        ToolType toolType = transformer.getToolType();

        // verifications
        assertThat(toolType).isEqualTo(ToolType.FLEET_MDM);
    }

    @Test
    void createClient_realTransformer_returnsFleetClient() {
        // setup
        FleetMdmAgentIdTransformer realTransformer = new FleetMdmAgentIdTransformer(integratedToolService, toolUrlService);

        // execution
        FleetMdmClient client = realTransformer.createClient("http://fleet:8080", "api-token");

        // verifications
        assertThat(client).isNotNull();
    }

    private void stubTool() {
        when(integratedToolService.getToolByKey(TOOL_ID)).thenReturn(Optional.of(tool));
        when(toolUrlService.getUrlByToolType(tool, ToolUrlType.API)).thenReturn(Optional.of(toolUrl));
    }

    private static Host host(Long id, String uuid, String osqueryHostId, String osqueryVersion, String lastEnrolledAt) {
        Host host = new Host();
        host.setId(id);
        host.setUuid(uuid);
        host.setOsqueryHostId(osqueryHostId);
        host.setOsqueryVersion(osqueryVersion);
        host.setLastEnrolledAt(lastEnrolledAt);
        return host;
    }
}
