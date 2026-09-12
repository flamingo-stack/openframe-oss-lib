package com.openframe.client.service;

import com.openframe.client.service.rmm.SoftwareDeviceLocalScheduleService;
import com.openframe.client.service.rmm.SoftwareScheduleExecutionService;
import com.openframe.client.service.rmm.SoftwareScheduleFireDispatcher;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;

class SoftwareScheduleExecutionServiceTest {

    private static final String TENANT = "t-1";

    private final SoftwareScheduleRepository scheduleRepository = mock(SoftwareScheduleRepository.class);
    private final SoftwareScheduleTargetResolver targetResolver = mock(SoftwareScheduleTargetResolver.class);
    private final SoftwareScheduleFireDispatcher fireDispatcher = mock(SoftwareScheduleFireDispatcher.class);
    private final SoftwareDeviceLocalScheduleService deviceLocalScheduleService = mock(SoftwareDeviceLocalScheduleService.class);

    private final SoftwareScheduleExecutionService service =
            new SoftwareScheduleExecutionService(scheduleRepository, targetResolver, fireDispatcher, deviceLocalScheduleService);

    @Test
    @DisplayName("a due repeating schedule fires to its SPECIFIC targets and advances nextRunAt into the future")
    void runDue_firesAndAdvancesRepeat() {
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE)
                .repeat(3600L).nextRunAt(Instant.now().minusSeconds(30))
                .build();
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(schedule));
        when(targetResolver.resolveMachineIds(TENANT, "ss-1")).thenReturn(List.of("m-1", "m-2"));

        service.runDueSchedules();

        verify(fireDispatcher).dispatch(eq(schedule), eq(List.of("m-1", "m-2")), any());
        ArgumentCaptor<SoftwareSchedule> saved = ArgumentCaptor.forClass(SoftwareSchedule.class);
        verify(scheduleRepository).save(saved.capture());
        assertThat(saved.getValue().getNextRunAt()).isAfter(Instant.now());
        assertThat(saved.getValue().getLastRunAt()).isNotNull();
    }

    @Test
    @DisplayName("a one-shot schedule (no repeat) fires once and clears nextRunAt so it never fires again")
    void runDue_oneShotClearsNextRunAt() {
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE)
                .repeat(null).nextRunAt(Instant.now().minusSeconds(30))
                .build();
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(schedule));
        when(targetResolver.resolveMachineIds(TENANT, "ss-1")).thenReturn(List.of("m-1"));

        service.runDueSchedules();

        verify(fireDispatcher).dispatch(eq(schedule), eq(List.of("m-1")), any());
        ArgumentCaptor<SoftwareSchedule> saved = ArgumentCaptor.forClass(SoftwareSchedule.class);
        verify(scheduleRepository).save(saved.capture());
        assertThat(saved.getValue().getNextRunAt()).isNull();
    }

    @Test
    @DisplayName("no due schedules → nothing fired or saved")
    void runDue_noneDue_noop() {
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of());

        service.runDueSchedules();

        verify(fireDispatcher, never()).dispatch(any(), any(), any());
        verify(scheduleRepository, never()).save(any());
    }
}
