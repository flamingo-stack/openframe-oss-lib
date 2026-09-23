package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.sdk.fleetmdm.model.Host;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetHostMachineResolverTest {

    private static final String TENANT = "t1";

    @Mock private MachineRepository machineRepository;
    @InjectMocks private FleetHostMachineResolver resolver;

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
}
