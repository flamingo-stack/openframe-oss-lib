package com.openframe.client.service.agentregistration.fleet;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.exception.FleetMdmException;
import com.openframe.sdk.fleetmdm.model.Host;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetHostFactsBackfillServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final Duration RECHECK_AFTER = Duration.ofDays(7);

    @Mock
    private MachineRepository machineRepository;

    @Mock
    private ToolConnectionRepository toolConnectionRepository;

    @Mock
    private FleetMdmClients fleetMdmClients;

    @Mock
    private FleetHostFactsWriter fleetHostFactsWriter;

    @Mock
    private TenantIdProvider tenantIdProvider;

    @Mock
    private FleetMdmClient fleetClient;

    @InjectMocks
    private FleetHostFactsBackfillService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "recheckAfter", RECHECK_AFTER);
        lenient().when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
    }

    @Test
    void backfill_asksForTheTenantsMachinesCheckedBeforeTheRecheckAge_atMostTheCap() {
        // setup
        when(machineRepository.findDueForFleetHostFacts(anyString(), any(Instant.class), anyInt())).thenReturn(List.of());
        Instant before = Instant.now();

        // execution
        service.backfill();

        // verifications
        ArgumentCaptor<Instant> checkedBefore = ArgumentCaptor.forClass(Instant.class);
        verify(machineRepository).findDueForFleetHostFacts(eq(TENANT_ID), checkedBefore.capture(),
                eq(FleetHostFactsBackfillService.MACHINES_PER_RUN));
        assertThat(checkedBefore.getValue())
                .isBetween(before.minus(RECHECK_AFTER), Instant.now().minus(RECHECK_AFTER));
    }

    @Test
    void backfill_nothingDue_noConnectionReadAndNoFleetClient() {
        // setup
        due();

        // execution
        service.backfill();

        // verifications
        verifyNoInteractions(toolConnectionRepository, fleetMdmClients, fleetHostFactsWriter);
    }

    @Test
    void backfill_dueMachine_filledFromItsFleetHostAndStamped() {
        // setup
        Machine blank = machine("m-1");
        Host host = new Host();
        due(blank);
        connections(List.of("m-1"), connection("m-1", "11"));
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.getHostById(11L)).thenReturn(host);

        // execution
        service.backfill();

        // verifications
        verify(fleetHostFactsWriter).fill(blank, host);
        verify(machineRepository).markHostFactsChecked(eq("m-1"), any(Instant.class));
    }

    @Test
    void backfill_readsOnlyTheConnectedFleetConnectionsOfTheDueMachines() {
        // setup
        due(machine("m-1"), machine("m-2"));
        connections(List.of("m-1", "m-2"));

        // execution
        service.backfill();

        // verifications
        verify(toolConnectionRepository).findByTenantIdAndMachineIdInAndToolTypeAndStatus(
                TENANT_ID, List.of("m-1", "m-2"), ToolType.FLEET_MDM, ConnectionStatus.CONNECTED);
    }

    @Test
    void backfill_machineWithoutAFleetConnection_stampedWithoutCallingFleet() {
        // setup
        due(machine("m-1"));
        connections(List.of("m-1"));

        // execution
        service.backfill();

        // verifications
        verify(machineRepository).markHostFactsChecked(eq("m-1"), any(Instant.class));
        verifyNoInteractions(fleetMdmClients, fleetHostFactsWriter);
    }

    @Test
    void backfill_hostNeverConfirmedByFleet_stampedWithoutCallingFleet() {
        // setup
        due(machine("m-1"));
        connections(List.of("m-1"), connection("m-1", "6F1A2B3C-0000-4D5E-8F90-123456789ABC"));

        // execution
        service.backfill();

        // verifications
        verify(machineRepository).markHostFactsChecked(eq("m-1"), any(Instant.class));
        verifyNoInteractions(fleetMdmClients, fleetHostFactsWriter);
    }

    @Test
    void backfill_hostIdTooLongForALong_stampedAndTheOthersStillRead() {
        // setup
        Machine next = machine("m-2");
        Host host = new Host();
        due(machine("m-1"), next);
        connections(List.of("m-1", "m-2"), connection("m-1", "1234567890123456789012345"), connection("m-2", "12"));
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.getHostById(12L)).thenReturn(host);

        // execution
        service.backfill();

        // verifications
        verify(fleetHostFactsWriter).fill(next, host);
        verify(fleetClient, times(1)).getHostById(anyLong());
        verify(machineRepository).markHostFactsChecked(eq("m-1"), any(Instant.class));
    }

    @Test
    void backfill_machinesWithoutAHostStampedBeforeTheFleetClientIsCreated_soAMissingFleetDoesNotKeepThemDue() {
        // setup
        due(machine("m-1"), machine("m-2"));
        connections(List.of("m-1", "m-2"), connection("m-2", "12"));
        when(fleetMdmClients.client()).thenThrow(new IllegalStateException("Found no tool with id fleetmdm-server"));

        // execution
        Throwable thrown = catchThrowable(service::backfill);

        // verifications
        assertThat(thrown).isInstanceOf(IllegalStateException.class);
        InOrder order = inOrder(machineRepository, fleetMdmClients);
        order.verify(machineRepository).markHostFactsChecked(eq("m-1"), any(Instant.class));
        order.verify(fleetMdmClients).client();
        verify(machineRepository, never()).markHostFactsChecked(eq("m-2"), any(Instant.class));
    }

    @Test
    void backfill_oneHostLookupFails_theOtherMachinesStillFilled() {
        // setup
        Machine first = machine("m-1");
        Machine second = machine("m-2");
        Host host = new Host();
        due(first, second);
        connections(List.of("m-1", "m-2"), connection("m-1", "11"), connection("m-2", "12"));
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.getHostById(11L)).thenThrow(new FleetMdmException("Failed to fetch Fleet host 11"));
        when(fleetClient.getHostById(12L)).thenReturn(host);

        // execution
        service.backfill();

        // verifications
        verify(fleetHostFactsWriter).fill(second, host);
        verify(fleetHostFactsWriter, never()).fill(eq(first), any(Host.class));
    }

    @Test
    void backfill_eachCompletedRead_stampedWhetherFleetFilledAnythingOrNot_aFailedReadNot() {
        // setup
        due(machine("m-1"), machine("m-2"), machine("m-3"));
        connections(List.of("m-1", "m-2", "m-3"),
                connection("m-1", "11"), connection("m-2", "12"), connection("m-3", "13"));
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.getHostById(11L)).thenReturn(new Host());
        when(fleetClient.getHostById(12L)).thenReturn(null);
        when(fleetClient.getHostById(13L)).thenThrow(new FleetMdmException("Failed to fetch Fleet host 13"));
        Instant before = Instant.now();

        // execution
        service.backfill();

        // verifications
        ArgumentCaptor<Instant> stamp = ArgumentCaptor.forClass(Instant.class);
        verify(machineRepository).markHostFactsChecked(eq("m-1"), stamp.capture());
        verify(machineRepository).markHostFactsChecked(eq("m-2"), any(Instant.class));
        verify(machineRepository, never()).markHostFactsChecked(eq("m-3"), any(Instant.class));
        assertThat(stamp.getValue()).isAfterOrEqualTo(before);
    }

    @Test
    void backfill_hostGoneFromFleet_nothingWritten() {
        // setup
        due(machine("m-1"));
        connections(List.of("m-1"), connection("m-1", "11"));
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.getHostById(11L)).thenReturn(null);

        // execution
        service.backfill();

        // verifications
        verifyNoInteractions(fleetHostFactsWriter);
    }

    @Test
    void backfill_machinesReadInTheOrderTheQueryReturnsThem() {
        // setup
        Machine neverChecked = machine("m-2");
        Machine checkedLongAgo = machine("m-1");
        due(neverChecked, checkedLongAgo);
        connections(List.of("m-2", "m-1"), connection("m-1", "11"), connection("m-2", "12"));
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.getHostById(anyLong())).thenReturn(new Host());

        // execution
        service.backfill();

        // verifications
        InOrder order = inOrder(fleetClient);
        order.verify(fleetClient).getHostById(12L);
        order.verify(fleetClient).getHostById(11L);
    }

    private void due(Machine... machines) {
        when(machineRepository.findDueForFleetHostFacts(eq(TENANT_ID), any(Instant.class),
                eq(FleetHostFactsBackfillService.MACHINES_PER_RUN))).thenReturn(List.of(machines));
    }

    private void connections(List<String> machineIds, ToolConnection... connections) {
        when(toolConnectionRepository.findByTenantIdAndMachineIdInAndToolTypeAndStatus(
                TENANT_ID, machineIds, ToolType.FLEET_MDM, ConnectionStatus.CONNECTED)).thenReturn(List.of(connections));
    }

    private static ToolConnection connection(String machineId, String agentToolId) {
        ToolConnection connection = new ToolConnection();
        connection.setId("c-" + machineId);
        connection.setMachineId(machineId);
        connection.setToolType(ToolType.FLEET_MDM);
        connection.setStatus(ConnectionStatus.CONNECTED);
        connection.setAgentToolId(agentToolId);
        return connection;
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setStatus(DeviceStatus.ONLINE);
        return machine;
    }
}
