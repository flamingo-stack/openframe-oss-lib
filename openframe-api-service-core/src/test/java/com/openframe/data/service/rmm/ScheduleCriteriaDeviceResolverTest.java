package com.openframe.data.service.rmm;

import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceCriteria;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.repository.device.MachineRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static com.openframe.data.document.rmm.script.OsType.MAC_OS;
import static com.openframe.data.document.rmm.script.OsType.WINDOWS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleCriteriaDeviceResolverTest {

    private static final String TENANT = "tenant-1";

    @Mock private MachineRepository machineRepository;
    @InjectMocks private ScheduleCriteriaDeviceResolver resolver;

    @Test
    @DisplayName("resolveMachineIds: criteria OS ∩ supportedPlatforms is passed as the scope; org/type land on the filter")
    void resolve_intersectsOsScopeAndBuildsFilter() {
        ScheduleDeviceCriteria criteria = ScheduleDeviceCriteria.builder()
                .organizationIds(List.of("org-1"))
                .deviceTypes(List.of(DeviceType.DESKTOP))
                .osTypes(List.of(WINDOWS, MAC_OS))
                .build();
        when(machineRepository.findMachineIdsByCriteria(eq(TENANT), any(), eq(List.of(WINDOWS))))
                .thenReturn(List.of("m-1", "m-2"));

        List<String> result = resolver.resolveMachineIds(TENANT, criteria, List.of(WINDOWS));

        assertThat(result).containsExactly("m-1", "m-2");
        ArgumentCaptor<MachineQueryFilter> filter = ArgumentCaptor.forClass(MachineQueryFilter.class);
        verify(machineRepository).findMachineIdsByCriteria(eq(TENANT), filter.capture(), eq(List.of(WINDOWS)));
        assertThat(filter.getValue().getOrganizationIds()).containsExactly("org-1");
        assertThat(filter.getValue().getDeviceTypes()).containsExactly(DeviceType.DESKTOP.name());
    }

    @Test
    @DisplayName("resolveMachineIds: a contradictory OS scope (criteria OS disjoint from supported) matches nothing — no query")
    void resolve_contradictoryScope_shortCircuits() {
        ScheduleDeviceCriteria criteria = ScheduleDeviceCriteria.builder().osTypes(List.of(WINDOWS)).build();

        assertThat(resolver.resolveMachineIds(TENANT, criteria, List.of(MAC_OS))).isEmpty();
        verify(machineRepository, never()).findMachineIdsByCriteria(any(), any(), any());
    }

    @Test
    @DisplayName("resolveMachineIds: no OS anywhere → unconstrained scope (null) passed through to the repository")
    void resolve_unconstrained_passesNullScope() {
        ScheduleDeviceCriteria criteria = ScheduleDeviceCriteria.builder().organizationIds(List.of("org-1")).build();
        when(machineRepository.findMachineIdsByCriteria(eq(TENANT), any(), eq(null))).thenReturn(List.of("m-9"));

        assertThat(resolver.resolveMachineIds(TENANT, criteria, null)).containsExactly("m-9");
    }

    @Test
    @DisplayName("matches: device satisfies every constrained dimension; a wrong OS or org fails it")
    void matches_perDimension() {
        ScheduleDeviceCriteria criteria = ScheduleDeviceCriteria.builder()
                .organizationIds(List.of("org-1")).osTypes(List.of(WINDOWS)).build();

        assertThat(resolver.matches(machine("org-1", WINDOWS), criteria, null)).isTrue();
        assertThat(resolver.matches(machine("org-1", MAC_OS), criteria, null)).isFalse();   // wrong OS
        assertThat(resolver.matches(machine("org-2", WINDOWS), criteria, null)).isFalse();   // wrong org
        assertThat(resolver.matches(null, criteria, null)).isFalse();
    }

    private static Machine machine(String orgId, OsType osType) {
        Machine m = new Machine();
        m.setMachineId("m");
        m.setOrganizationId(orgId);
        m.setOsType(osType);
        return m;
    }
}
