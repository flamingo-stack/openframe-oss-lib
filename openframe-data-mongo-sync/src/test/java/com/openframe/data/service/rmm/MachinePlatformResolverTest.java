package com.openframe.data.service.rmm;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachinePlatformResolverTest {

    private static final String TENANT = "t1";

    @Mock private MachineRepository machineRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    private MachinePlatformResolver resolver() {
        return new MachinePlatformResolver(machineRepository, tenantIdProvider);
    }

    @Test
    @DisplayName("osTypesByMachineId: empty input short-circuits without touching the repository")
    void osTypes_empty_noQuery() {
        assertThat(resolver().osTypesByMachineId(List.of())).isEmpty();
        assertThat(resolver().osTypesByMachineId(null)).isEmpty();
        verifyNoInteractions(machineRepository, tenantIdProvider);
    }

    @Test
    @DisplayName("osTypesByMachineId: maps machineId → OS, dropping machines with no recorded OS")
    void osTypes_mapsAndDropsNull() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m1", OsType.MAC_OS), machine("m2", OsType.WINDOWS), machine("m3", null)));

        Map<String, OsType> result = resolver().osTypesByMachineId(List.of("m1", "m2", "m3"));

        assertThat(result).containsOnly(
                Map.entry("m1", OsType.MAC_OS),
                Map.entry("m2", OsType.WINDOWS));
    }

    @Test
    @DisplayName("compatible: an empty or absent platform set matches nothing")
    void compatible_noPlatforms_empty() {
        Map<String, OsType> osTypes = Map.of("m1", OsType.MAC_OS);
        assertThat(resolver().compatible(List.of("m1"), osTypes, List.of())).isEmpty();
        assertThat(resolver().compatible(List.of("m1"), osTypes, null)).isEmpty();
    }

    @Test
    @DisplayName("compatible: keeps only OS-matching machines, drops unknown-OS ones, preserves input order")
    void compatible_filtersByOs() {
        Map<String, OsType> osTypes = Map.of(
                "m-mac", OsType.MAC_OS,
                "m-win", OsType.WINDOWS);
        List<String> ids = List.of("m-win", "m-unknown", "m-mac");

        assertThat(resolver().compatible(ids, osTypes, List.of(OsType.MAC_OS)))
                .containsExactly("m-mac");
        assertThat(resolver().compatible(ids, osTypes, List.of(OsType.MAC_OS, OsType.WINDOWS)))
                .containsExactly("m-win", "m-mac");
    }

    private static Machine machine(String machineId, OsType osType) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setOsType(osType);
        return m;
    }
}
