package com.openframe.data.service.rmm;

import com.openframe.data.document.rmm.schedule.ScheduleLocalMachineTimeDispatch;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import com.openframe.data.repository.rmm.ScheduleDeviceLocalDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareScheduleTargetResolverTest {

    private static final String TENANT = "t1";
    private static final Instant OCCURRENCE = Instant.parse("2026-11-18T09:00:00Z");

    @Mock private SoftwareScheduleMachineAssignedRepository assignedRepository;
    @Mock private ScheduleCriteriaDeviceResolver criteriaResolver;
    @Mock private PackageManagerAvailability packageManagerAvailability;
    @Mock private ScheduleDeviceLocalDispatchRepository scheduleDeviceLocalDispatchRepository;

    @InjectMocks private SoftwareScheduleTargetResolver resolver;

    @Test
    void resolveMachineIdsAwaitingDeviceTime_oneOffRanOnOneDevice_onlyTheOtherDeviceAwaits() {
        // setup
        SoftwareSchedule oneOff = schedule("s1", null);
        stubAssigned("s1", "m1", "m2");
        when(scheduleDeviceLocalDispatchRepository.findByScheduleIdIn(List.of("s1")))
                .thenReturn(List.of(run("s1", "m1", OCCURRENCE)));

        // execution
        Map<String, List<String>> awaiting = resolver.resolveMachineIdsAwaitingDeviceTime(List.of(oneOff));

        // verifications
        assertThat(awaiting).containsExactly(Map.entry("s1", List.of("m2")));
    }

    @Test
    void resolveMachineIdsAwaitingDeviceTime_oneOffRanOnEveryDevice_noDeviceAwaits() {
        // setup
        SoftwareSchedule oneOff = schedule("s1", null);
        stubAssigned("s1", "m1", "m2");
        when(scheduleDeviceLocalDispatchRepository.findByScheduleIdIn(List.of("s1")))
                .thenReturn(List.of(run("s1", "m1", OCCURRENCE), run("s1", "m2", OCCURRENCE)));

        // execution
        Map<String, List<String>> awaiting = resolver.resolveMachineIdsAwaitingDeviceTime(List.of(oneOff));

        // verifications
        assertThat(awaiting).containsExactly(Map.entry("s1", List.of()));
    }

    @Test
    void resolveMachineIdsAwaitingDeviceTime_runWithoutAnOccurrence_deviceStillAwaits() {
        // setup
        SoftwareSchedule oneOff = schedule("s1", null);
        stubAssigned("s1", "m1");
        when(scheduleDeviceLocalDispatchRepository.findByScheduleIdIn(List.of("s1")))
                .thenReturn(List.of(run("s1", "m1", null)));

        // execution
        Map<String, List<String>> awaiting = resolver.resolveMachineIdsAwaitingDeviceTime(List.of(oneOff));

        // verifications
        assertThat(awaiting).containsExactly(Map.entry("s1", List.of("m1")));
    }

    @Test
    void resolveMachineIdsAwaitingDeviceTime_severalOneOffs_oneReadOfTheRunsForAll() {
        // setup
        SoftwareSchedule first = schedule("s1", null);
        SoftwareSchedule second = schedule("s2", null);
        stubAssigned("s1", "m1");
        stubAssigned("s2", "m1");
        when(scheduleDeviceLocalDispatchRepository.findByScheduleIdIn(List.of("s1", "s2")))
                .thenReturn(List.of(run("s2", "m1", OCCURRENCE)));

        // execution
        Map<String, List<String>> awaiting = resolver.resolveMachineIdsAwaitingDeviceTime(List.of(first, second));

        // verifications
        assertThat(awaiting)
                .containsEntry("s1", List.of("m1"))
                .containsEntry("s2", List.of());
    }

    @Test
    void resolveMachineIdsAwaitingDeviceTime_repeating_everyDeviceAwaitsWithoutReadingTheRuns() {
        // setup
        SoftwareSchedule daily = schedule("s1", 86400L);
        stubAssigned("s1", "m1");

        // execution
        Map<String, List<String>> awaiting = resolver.resolveMachineIdsAwaitingDeviceTime(List.of(daily));

        // verifications
        assertThat(awaiting).containsExactly(Map.entry("s1", List.of("m1")));
        verifyNoInteractions(scheduleDeviceLocalDispatchRepository);
    }

    private void stubAssigned(String scheduleId, String... machineIds) {
        List<SoftwareScheduleMachineAssigned> assigned = Arrays.stream(machineIds)
                .map(machineId -> SoftwareScheduleMachineAssigned.builder()
                        .tenantId(TENANT).softwareScheduleId(scheduleId).machineId(machineId).build())
                .toList();
        when(assignedRepository.findOnPrimaryByTenantIdAndSoftwareScheduleId(TENANT, scheduleId)).thenReturn(assigned);
    }

    private static SoftwareSchedule schedule(String id, Long repeat) {
        return SoftwareSchedule.builder().id(id).tenantId(TENANT).repeat(repeat).build();
    }

    private static ScheduleLocalMachineTimeDispatch run(String scheduleId, String machineId, Instant occurrenceAt) {
        return ScheduleLocalMachineTimeDispatch.builder()
                .scheduleId(scheduleId).machineId(machineId).lastOccurrenceAt(occurrenceAt).build();
    }
}
