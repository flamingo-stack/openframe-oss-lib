package com.openframe.client.service.agentregistration.transformer;

import com.openframe.client.service.agentregistration.fleet.FleetHostFactsWriter;
import com.openframe.client.service.agentregistration.fleet.FleetMdmClients;
import com.openframe.data.document.tool.ToolType;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.exception.FleetMdmNotFoundException;
import com.openframe.sdk.fleetmdm.model.Host;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmAgentIdTransformerTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String HARDWARE_UUID = "5C0B4A3E-1F2D-4E6A-9B8C-7D6E5F4A3B2C";
    private static final String OTHER_UUID = "0A1B2C3D-4E5F-4061-8273-8495A6B7C8D9";
    private static final String INSTANCE_ID = "6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b";
    private static final String OSQUERY_VERSION = "5.12.0";
    private static final String ENROLLED_JANUARY = "2026-01-01T00:00:00Z";
    private static final String ENROLLED_FEBRUARY = "2026-02-01T00:00:00Z";
    private static final String TRANSFORM_FAILED = "Failed to transform Fleet MDM agent tool ID";
    private static final String NO_HOST_FOUND = "No valid fleetmdm-agent mdm host found";

    @Mock private FleetMdmClients fleetMdmClients;
    @Mock private FleetHostFactsWriter fleetHostFactsWriter;
    @Mock private FleetMdmClient fleetClient;

    @InjectMocks private FleetMdmAgentIdTransformer transformer;

    @Test
    void transform_uuidMatch_returnsHostIdAndFillsFactsWithoutIdentifierLookup() {
        // setup
        stubClient();
        Host host = host(10L, HARDWARE_UUID, HARDWARE_UUID, OSQUERY_VERSION, ENROLLED_JANUARY);
        when(fleetClient.searchHosts(HARDWARE_UUID, 0, 2)).thenReturn(List.of(host));

        // execution
        String result = transformer.transform(MACHINE_ID, HARDWARE_UUID, false);

        // verifications
        assertThat(result).isEqualTo("10");
        verify(fleetHostFactsWriter).fill(MACHINE_ID, host);
        verify(fleetClient, never()).getHostByIdentifier(HARDWARE_UUID);
    }

    @Test
    void transform_uuidDuplicates_newestEnrolledWinsWithoutIdentifierLookup() {
        // setup
        stubClient();
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
    void transform_factsWriteFails_hostIdStillReturned() {
        // setup
        stubClient();
        Host host = host(10L, HARDWARE_UUID, HARDWARE_UUID, OSQUERY_VERSION, ENROLLED_JANUARY);
        when(fleetClient.searchHosts(HARDWARE_UUID, 0, 2)).thenReturn(List.of(host));
        doThrow(new IllegalStateException("Mongo unavailable")).when(fleetHostFactsWriter).fill(MACHINE_ID, host);

        // execution
        String result = transformer.transform(MACHINE_ID, HARDWARE_UUID, false);

        // verifications
        assertThat(result).isEqualTo("10");
    }

    @Test
    void transform_uuidHostWithoutOsqueryVersion_rejectedOnBothPathsAndThrows() {
        // setup
        stubClient();
        Host withoutVersion = host(10L, HARDWARE_UUID, HARDWARE_UUID, null, ENROLLED_JANUARY);
        when(fleetClient.searchHosts(HARDWARE_UUID, 0, 2)).thenReturn(List.of(withoutVersion));
        when(fleetClient.getHostByIdentifier(HARDWARE_UUID)).thenReturn(withoutVersion);

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> transformer.transform(MACHINE_ID, HARDWARE_UUID, false));

        // verifications
        assertThat(ex.getMessage()).contains(TRANSFORM_FAILED);
        assertThat(ex.getCause().getMessage()).contains(NO_HOST_FOUND);
        verifyNoInteractions(fleetHostFactsWriter);
    }

    @Test
    void transform_uuidHostWithoutOsqueryVersionLastAttempt_rawIdReturnedAndNothingFilled() {
        // setup
        stubClient();
        Host withoutVersion = host(10L, HARDWARE_UUID, HARDWARE_UUID, null, ENROLLED_JANUARY);
        when(fleetClient.searchHosts(HARDWARE_UUID, 0, 2)).thenReturn(List.of(withoutVersion));
        when(fleetClient.getHostByIdentifier(HARDWARE_UUID)).thenReturn(withoutVersion);

        // execution
        String result = transformer.transform(MACHINE_ID, HARDWARE_UUID, true);

        // verifications
        assertThat(result).isEqualTo(HARDWARE_UUID);
        verifyNoInteractions(fleetHostFactsWriter);
    }

    @Test
    void transform_searchEmptyAndIdentifierMatchesOsqueryHostId_returnsHostIdAndFillsFacts() {
        // setup
        stubClient();
        Host host = host(20L, HARDWARE_UUID, INSTANCE_ID, OSQUERY_VERSION, ENROLLED_JANUARY);
        when(fleetClient.searchHosts(INSTANCE_ID, 0, 2)).thenReturn(List.of());
        when(fleetClient.getHostByIdentifier(INSTANCE_ID)).thenReturn(host);

        // execution
        String result = transformer.transform(MACHINE_ID, INSTANCE_ID, false);

        // verifications
        assertThat(result).isEqualTo("20");
        verify(fleetHostFactsWriter).fill(MACHINE_ID, host);
    }

    @Test
    void transform_searchReturnsOtherUuidsAndIdentifierMatches_returnsIdentifierHostId() {
        // setup
        stubClient();
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
        stubClient();
        when(fleetClient.searchHosts(INSTANCE_ID, 0, 2)).thenReturn(List.of());
        when(fleetClient.getHostByIdentifier(INSTANCE_ID))
                .thenReturn(host(30L, HARDWARE_UUID, OTHER_UUID, OSQUERY_VERSION, ENROLLED_JANUARY));

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> transformer.transform(MACHINE_ID, INSTANCE_ID, false));

        // verifications
        assertThat(ex.getMessage()).contains(TRANSFORM_FAILED);
        assertThat(ex.getCause().getMessage()).contains(NO_HOST_FOUND);
    }

    @Test
    void transform_identifierOsqueryHostIdDiffersLastAttempt_returnsRawId() {
        // setup
        stubClient();
        when(fleetClient.searchHosts(INSTANCE_ID, 0, 2)).thenReturn(List.of());
        when(fleetClient.getHostByIdentifier(INSTANCE_ID))
                .thenReturn(host(30L, HARDWARE_UUID, OTHER_UUID, OSQUERY_VERSION, ENROLLED_JANUARY));

        // execution
        String result = transformer.transform(MACHINE_ID, INSTANCE_ID, true);

        // verifications
        assertThat(result).isEqualTo(INSTANCE_ID);
        verifyNoInteractions(fleetHostFactsWriter);
    }

    @Test
    void transform_identifierHostWithoutOsqueryVersionLastAttempt_returnsRawId() {
        // setup
        stubClient();
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
        stubClient();
        when(fleetClient.searchHosts(INSTANCE_ID, 0, 2)).thenReturn(List.of());
        when(fleetClient.getHostByIdentifier(INSTANCE_ID)).thenThrow(new FleetMdmNotFoundException("Fleet host not found: " + INSTANCE_ID, ""));

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> transformer.transform(MACHINE_ID, INSTANCE_ID, false));

        // verifications
        assertThat(ex.getMessage()).contains(TRANSFORM_FAILED);
        assertThat(ex.getCause().getMessage()).contains(NO_HOST_FOUND);
    }

    @Test
    void transform_identifierLookupFails_throwsIllegalStateWithFleetCause() {
        // setup
        stubClient();
        when(fleetClient.searchHosts(INSTANCE_ID, 0, 2)).thenReturn(List.of());
        FleetMdmApiException fleetFailure = new FleetMdmApiException("Failed to fetch host", 500, "boom");
        when(fleetClient.getHostByIdentifier(INSTANCE_ID)).thenThrow(fleetFailure);

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> transformer.transform(MACHINE_ID, INSTANCE_ID, true));

        // verifications
        assertThat(ex.getMessage()).contains(TRANSFORM_FAILED);
        assertThat(ex.getCause()).isSameAs(fleetFailure);
    }

    @Test
    void transform_fleetToolMissing_throwsIllegalStateWithCause() {
        // setup
        when(fleetMdmClients.client()).thenThrow(new IllegalStateException("Found no tool with id fleetmdm-server"));

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> transformer.transform(MACHINE_ID, HARDWARE_UUID, false));

        // verifications
        assertThat(ex.getMessage()).contains(TRANSFORM_FAILED);
        assertThat(ex.getCause().getMessage()).contains("Found no tool");
        verifyNoInteractions(fleetHostFactsWriter);
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
        verifyNoInteractions(fleetMdmClients, fleetClient, fleetHostFactsWriter);
    }

    @Test
    void getToolType_returnsFleetMdm() {
        // setup

        // execution
        ToolType toolType = transformer.getToolType();

        // verifications
        assertThat(toolType).isEqualTo(ToolType.FLEET_MDM);
    }

    private void stubClient() {
        when(fleetMdmClients.client()).thenReturn(fleetClient);
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
