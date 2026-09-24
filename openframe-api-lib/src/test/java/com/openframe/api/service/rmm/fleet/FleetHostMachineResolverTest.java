package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.sdk.fleetmdm.model.Host;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetHostMachineResolverTest {

    private static final String TENANT = "t1";
    private static final long HOST_ID = 29L;
    private static final String FLEET_HOSTNAME = "macbook-pro-hryhorii.local";
    private static final String MACHINE_HOSTNAME = "MacBook-Pro-Hryhorii.local";
    private static final Instant OLDER = Instant.parse("2026-09-01T00:00:00Z");
    private static final Instant NEWER = Instant.parse("2026-09-20T00:00:00Z");

    @Mock private MachineRepository machineRepository;
    @Mock private ToolConnectionRepository toolConnectionRepository;
    @InjectMocks private FleetHostMachineResolver resolver;

    @Test
    void resolve_hostLinkedByToolConnection_machineFoundDespiteHostnameCaseMismatch() {
        // setup
        Host host = new Host();
        host.setId(HOST_ID);
        host.setHostname(FLEET_HOSTNAME);
        Machine machine = machine(null, DeviceStatus.ONLINE);
        machine.setMachineId("m-1");
        machine.setHostname(MACHINE_HOSTNAME);
        when(toolConnectionRepository.findByAgentToolIdInAndToolType(List.of("29"), ToolType.FLEET_MDM))
                .thenReturn(List.of(connection("m-1", NEWER)));
        when(machineRepository.findByTenantIdAndMachineIdIn(TENANT, List.of("m-1"))).thenReturn(List.of(machine));

        // execution
        Map<Long, Machine> resolved = resolver.resolve(TENANT, List.of(host));

        // verifications
        assertThat(resolved).containsExactly(Map.entry(HOST_ID, machine));
    }

    @Test
    void resolve_hostClaimedByTwoConnections_newestConnectionWins() {
        // setup
        Host host = new Host();
        host.setId(HOST_ID);
        Machine stale = machine(null, DeviceStatus.OFFLINE);
        stale.setMachineId("m-stale");
        Machine current = machine(null, DeviceStatus.ONLINE);
        current.setMachineId("m-current");
        when(toolConnectionRepository.findByAgentToolIdInAndToolType(List.of("29"), ToolType.FLEET_MDM))
                .thenReturn(List.of(connection("m-stale", OLDER), connection("m-current", NEWER)));
        when(machineRepository.findByTenantIdAndMachineIdIn(TENANT, List.of("m-stale", "m-current")))
                .thenReturn(List.of(stale, current));

        // execution
        Map<Long, Machine> resolved = resolver.resolve(TENANT, List.of(host));

        // verifications
        assertThat(resolved).containsExactly(Map.entry(HOST_ID, current));
    }

    @Test
    void resolve_noToolConnections_machineLookupByIdSkipped() {
        // setup
        when(machineRepository.findByTenantIdAndOsUuidIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("u-online", DeviceStatus.ONLINE)));

        // execution
        Map<Long, Machine> resolved = resolver.resolve(TENANT, List.of(host(1L, "u-online")));

        // verifications
        assertThat(resolved).containsOnlyKeys(1L);
        verify(machineRepository, never()).findByTenantIdAndMachineIdIn(eq(TENANT), any());
    }

    @Test
    @DisplayName("resolve: correlates only ONLINE/OFFLINE machines; deleted/archived/decommissioned are dropped")
    void resolve_keepsOnlineAndOffline_dropsOthers() {
        when(machineRepository.findByTenantIdAndOsUuidIn(eq(TENANT), any())).thenReturn(List.of(
                machine("u-online", DeviceStatus.ONLINE),
                machine("u-offline", DeviceStatus.OFFLINE),
                machine("u-deleted", DeviceStatus.DELETED),
                machine("u-archived", DeviceStatus.ARCHIVED)));
        when(machineRepository.findByTenantIdAndSerialNumberIn(eq(TENANT), any())).thenReturn(List.of());
        when(machineRepository.findByTenantIdAndHostnameIn(eq(TENANT), any())).thenReturn(List.of());

        Map<Long, Machine> resolved = resolver.resolve(TENANT, List.of(
                host(1L, "u-online"), host(2L, "u-offline"), host(3L, "u-deleted"), host(4L, "u-archived")));

        assertThat(resolved.keySet()).containsExactlyInAnyOrder(1L, 2L);
    }

    @Test
    @DisplayName("resolve: a host matching a deleted machine by uuid but an online machine by serial correlates to the online one")
    void resolve_fallsBackPastDeletedMatch() {
        Host host = new Host();
        host.setId(1L);
        host.setUuid("u-deleted");
        host.setHardwareSerial("SER-1");

        when(machineRepository.findByTenantIdAndOsUuidIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("u-deleted", DeviceStatus.DELETED)));
        Machine online = machine(null, DeviceStatus.ONLINE);
        online.setSerialNumber("SER-1");
        online.setMachineId("m-online");
        when(machineRepository.findByTenantIdAndSerialNumberIn(eq(TENANT), any())).thenReturn(List.of(online));
        when(machineRepository.findByTenantIdAndHostnameIn(eq(TENANT), any())).thenReturn(List.of());

        Map<Long, Machine> resolved = resolver.resolve(TENANT, List.of(host));

        assertThat(resolved).containsKey(1L);
        assertThat(resolved.get(1L).getMachineId()).isEqualTo("m-online");
    }

    private static Host host(long id, String uuid) {
        Host h = new Host();
        h.setId(id);
        h.setUuid(uuid);
        return h;
    }

    private static Machine machine(String osUuid, DeviceStatus status) {
        Machine m = new Machine();
        m.setOsUuid(osUuid);
        m.setStatus(status);
        return m;
    }

    private static ToolConnection connection(String machineId, Instant connectedAt) {
        ToolConnection connection = new ToolConnection();
        connection.setMachineId(machineId);
        connection.setToolType(ToolType.FLEET_MDM);
        connection.setAgentToolId(String.valueOf(HOST_ID));
        connection.setConnectedAt(connectedAt);
        return connection;
    }
}
