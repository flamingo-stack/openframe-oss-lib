package com.openframe.client.service.agentregistration.transformer;

import com.openframe.client.service.agentregistration.fleet.FleetHostFactsWriter;
import com.openframe.client.service.agentregistration.fleet.FleetMdmClients;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.Host;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmAgentIdTransformerTest {

    private static final String MACHINE_ID = "m-1";
    private static final String HOST_UUID = "6F1A2B3C-0000-4D5E-8F90-123456789ABC";

    @Mock
    private FleetMdmClients fleetMdmClients;

    @Mock
    private FleetHostFactsWriter fleetHostFactsWriter;

    @Mock
    private FleetMdmClient fleetClient;

    @InjectMocks
    private FleetMdmAgentIdTransformer transformer;

    @Test
    void transform_matchingHost_hostIdReturnedAndItsFactsFilled() {
        // setup
        Host host = enrolledHost();
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.searchHosts(HOST_UUID, 0, 2)).thenReturn(List.of(host));

        // execution
        String hostId = transformer.transform(MACHINE_ID, HOST_UUID, false);

        // verifications
        assertThat(hostId).isEqualTo("42");
        verify(fleetHostFactsWriter).fill(MACHINE_ID, host);
    }

    @Test
    void transform_factsWriteFails_hostIdStillReturned() {
        // setup
        Host host = enrolledHost();
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.searchHosts(HOST_UUID, 0, 2)).thenReturn(List.of(host));
        doThrow(new IllegalStateException("Mongo unavailable")).when(fleetHostFactsWriter).fill(MACHINE_ID, host);

        // execution
        String hostId = transformer.transform(MACHINE_ID, HOST_UUID, false);

        // verifications
        assertThat(hostId).isEqualTo("42");
    }

    @Test
    void transform_hostNotEnrolledYetOnTheLastAttempt_uuidReturnedAndNothingFilled() {
        // setup
        Host pending = new Host();
        pending.setId(42L);
        pending.setUuid(HOST_UUID);
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.searchHosts(HOST_UUID, 0, 2)).thenReturn(List.of(pending));

        // execution
        String agentToolId = transformer.transform(MACHINE_ID, HOST_UUID, true);

        // verifications
        assertThat(agentToolId).isEqualTo(HOST_UUID);
        verifyNoInteractions(fleetHostFactsWriter);
    }

    @Test
    void transform_fleetToolMissing_failsAsBefore() {
        // setup
        when(fleetMdmClients.client()).thenThrow(new IllegalStateException("Found no tool with id fleetmdm-server"));

        // execution
        Throwable thrown = catchThrowable(() -> transformer.transform(MACHINE_ID, HOST_UUID, false));

        // verifications
        assertThat(thrown).isInstanceOf(IllegalStateException.class)
                .hasMessage("Failed to transform Fleet MDM agent tool ID");
        verifyNoInteractions(fleetHostFactsWriter);
    }

    private static Host enrolledHost() {
        Host host = new Host();
        host.setId(42L);
        host.setUuid(HOST_UUID);
        host.setOsqueryVersion("5.12.1");
        host.setLastEnrolledAt("2026-10-30T09:00:00Z");
        host.setHardwareSerial("C02XG2JHJG5H");
        return host;
    }
}
