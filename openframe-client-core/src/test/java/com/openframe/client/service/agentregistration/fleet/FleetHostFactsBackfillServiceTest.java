package com.openframe.client.service.agentregistration.fleet;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.exception.FleetMdmException;
import com.openframe.sdk.fleetmdm.model.Host;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Limit;

import java.util.List;
import java.util.stream.IntStream;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetHostFactsBackfillServiceTest {

    private static final int CAP = FleetHostFactsBackfillService.MACHINES_PER_RUN;
    private static final Limit PAGE = Limit.of(CAP);
    private static final String BEFORE_FIRST = FleetHostFactsBackfillService.BEFORE_FIRST_CONNECTION;

    @Mock
    private ToolConnectionRepository toolConnectionRepository;

    @Mock
    private MachineRepository machineRepository;

    @Mock
    private FleetMdmClients fleetMdmClients;

    @Mock
    private FleetHostFactsWriter fleetHostFactsWriter;

    @Mock
    private FleetMdmClient fleetClient;

    @InjectMocks
    private FleetHostFactsBackfillService service;

    @Test
    void backfill_machineWithoutSerial_filledFromItsFleetHost() {
        // setup
        Machine blank = machine("m-1", null);
        Machine known = machine("m-2", "C02XG2JHJG5H");
        Host host = new Host();
        pageAfter(BEFORE_FIRST, List.of(connection("c-1", "m-1", "11"), connection("c-2", "m-2", "12")));
        when(machineRepository.findByMachineIdIn(List.of("m-1", "m-2"))).thenReturn(List.of(blank, known));
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.getHostById(11L)).thenReturn(host);

        // execution
        service.backfill();

        // verifications
        verify(fleetHostFactsWriter).fill(blank, host);
        verify(fleetClient, never()).getHostById(12L);
    }

    @Test
    void backfill_hostNeverConfirmedByFleet_skippedWithoutCallingFleet() {
        // setup
        pageAfter(BEFORE_FIRST, List.of(connection("c-1", "m-1", "6F1A2B3C-0000-4D5E-8F90-123456789ABC")));
        when(machineRepository.findByMachineIdIn(List.of("m-1"))).thenReturn(List.of(machine("m-1", null)));

        // execution
        service.backfill();

        // verifications
        verifyNoInteractions(fleetMdmClients, fleetHostFactsWriter);
    }

    @Test
    void backfill_hostIdTooLongForALong_skippedAndTheWalkMovesOn() {
        // setup
        Machine overflowing = machine("m-1", null);
        Machine next = machine("m-2", null);
        Host host = new Host();
        pageAfter(BEFORE_FIRST, List.of(connection("c-1", "m-1", "1234567890123456789012345"), connection("c-2", "m-2", "12")));
        when(machineRepository.findByMachineIdIn(List.of("m-1", "m-2"))).thenReturn(List.of(overflowing, next));
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.getHostById(12L)).thenReturn(host);

        // execution
        service.backfill();

        // verifications
        verify(fleetHostFactsWriter).fill(next, host);
        verify(fleetClient, times(1)).getHostById(anyLong());
    }

    @Test
    void backfill_deletedMachine_skipped() {
        // setup
        Machine deleted = machine("m-1", null);
        deleted.setStatus(DeviceStatus.DELETED);
        pageAfter(BEFORE_FIRST, List.of(connection("c-1", "m-1", "11")));
        when(machineRepository.findByMachineIdIn(List.of("m-1"))).thenReturn(List.of(deleted));

        // execution
        service.backfill();

        // verifications
        verifyNoInteractions(fleetMdmClients, fleetHostFactsWriter);
    }

    @Test
    void backfill_oneHostLookupFails_theOtherMachinesStillFilled() {
        // setup
        Machine first = machine("m-1", null);
        Machine second = machine("m-2", null);
        Host host = new Host();
        pageAfter(BEFORE_FIRST, List.of(connection("c-1", "m-1", "11"), connection("c-2", "m-2", "12")));
        when(machineRepository.findByMachineIdIn(List.of("m-1", "m-2"))).thenReturn(List.of(first, second));
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
    void backfill_hostGoneFromFleet_nothingWritten() {
        // setup
        pageAfter(BEFORE_FIRST, List.of(connection("c-1", "m-1", "11")));
        when(machineRepository.findByMachineIdIn(List.of("m-1"))).thenReturn(List.of(machine("m-1", null)));
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.getHostById(11L)).thenReturn(null);

        // execution
        service.backfill();

        // verifications
        verifyNoInteractions(fleetHostFactsWriter);
    }

    @Test
    void backfill_moreMachinesThanTheCap_stopsAtTheCapAndResumesAfterTheLastOne() {
        // setup
        List<ToolConnection> fullPage = IntStream.range(0, CAP)
                .mapToObj(index -> connection("c-" + index, "m-" + index, String.valueOf(1000 + index)))
                .toList();
        List<Machine> machines = IntStream.range(0, CAP)
                .mapToObj(index -> machine("m-" + index, null))
                .toList();
        String lastId = "c-" + (CAP - 1);
        pageAfter(BEFORE_FIRST, fullPage);
        pageAfter(lastId, List.of());
        when(machineRepository.findByMachineIdIn(anyCollection())).thenReturn(machines);
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.getHostById(anyLong())).thenReturn(new Host());

        // execution
        service.backfill();
        service.backfill();

        // verifications
        verify(fleetClient, times(CAP)).getHostById(anyLong());
        verify(toolConnectionRepository).findByToolTypeAndStatusAndIdGreaterThanOrderByIdAsc(
                ToolType.FLEET_MDM, ConnectionStatus.CONNECTED, BEFORE_FIRST, PAGE);
        verify(toolConnectionRepository).findByToolTypeAndStatusAndIdGreaterThanOrderByIdAsc(
                ToolType.FLEET_MDM, ConnectionStatus.CONNECTED, lastId, PAGE);
    }

    @Test
    void backfill_pageWithoutCandidates_walksOnToTheNextPage() {
        // setup
        List<ToolConnection> knownPage = IntStream.range(0, CAP)
                .mapToObj(index -> connection("c-" + index, "m-" + index, String.valueOf(1000 + index)))
                .toList();
        List<Machine> knownMachines = IntStream.range(0, CAP)
                .mapToObj(index -> machine("m-" + index, "SERIAL-" + index))
                .toList();
        Machine blank = machine("m-blank", null);
        Host host = new Host();
        pageAfter(BEFORE_FIRST, knownPage);
        pageAfter("c-" + (CAP - 1), List.of(connection("c-blank", "m-blank", "77")));
        when(machineRepository.findByMachineIdIn(anyCollection())).thenReturn(knownMachines, List.of(blank));
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.getHostById(77L)).thenReturn(host);

        // execution
        service.backfill();

        // verifications
        verify(fleetHostFactsWriter).fill(blank, host);
        verify(fleetClient, times(1)).getHostById(anyLong());
    }

    @Test
    void backfill_endOfTheConnections_nextRunStartsAgainAtTheFirst() {
        // setup
        Machine blank = machine("m-1", null);
        Host host = new Host();
        pageAfter(BEFORE_FIRST, List.of(connection("c-1", "m-1", "11")));
        when(machineRepository.findByMachineIdIn(List.of("m-1"))).thenReturn(List.of(blank));
        when(fleetMdmClients.client()).thenReturn(fleetClient);
        when(fleetClient.getHostById(11L)).thenReturn(host);

        // execution
        service.backfill();
        service.backfill();

        // verifications
        verify(toolConnectionRepository, times(2)).findByToolTypeAndStatusAndIdGreaterThanOrderByIdAsc(
                ToolType.FLEET_MDM, ConnectionStatus.CONNECTED, BEFORE_FIRST, PAGE);
        verify(fleetHostFactsWriter, times(2)).fill(blank, host);
    }

    @Test
    void backfill_noFleetConnections_noMachineReadAndNoFleetClient() {
        // setup
        pageAfter(BEFORE_FIRST, List.of());

        // execution
        service.backfill();

        // verifications
        verifyNoInteractions(machineRepository, fleetMdmClients, fleetHostFactsWriter);
    }

    private void pageAfter(String cursor, List<ToolConnection> page) {
        when(toolConnectionRepository.findByToolTypeAndStatusAndIdGreaterThanOrderByIdAsc(
                ToolType.FLEET_MDM, ConnectionStatus.CONNECTED, cursor, PAGE)).thenReturn(page);
    }

    private static ToolConnection connection(String id, String machineId, String agentToolId) {
        ToolConnection connection = new ToolConnection();
        connection.setId(id);
        connection.setMachineId(machineId);
        connection.setToolType(ToolType.FLEET_MDM);
        connection.setStatus(ConnectionStatus.CONNECTED);
        connection.setAgentToolId(agentToolId);
        return connection;
    }

    private static Machine machine(String machineId, String serialNumber) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setStatus(DeviceStatus.ONLINE);
        machine.setSerialNumber(serialNumber);
        return machine;
    }
}
