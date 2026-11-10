package com.openframe.api.service.rmm.schedule;

import com.openframe.core.exception.NotFoundException;
import com.openframe.core.exception.ConflictException;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleFeasibilityTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SCHEDULE_ID = "schedule-1";

    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private ScheduleScriptService service;

    @Test
    void requireExisting_deletedSchedule_preservesRepeatDeleteEligibility() {
        // setup
        ScheduleScript schedule = ScheduleScript.builder().status(ScriptStatus.DELETED).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(schedule));

        // execution
        ScheduleScript result = service.requireExisting(SCHEDULE_ID);

        // verifications
        assertThat(result.getStatus()).isEqualTo(ScriptStatus.DELETED);
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    void get_deletedSchedule_preservesVisibleLookupRejection() {
        // setup
        ScheduleScript schedule = ScheduleScript.builder().status(ScriptStatus.DELETED).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(schedule));

        // execution
        Throwable failure = catchThrowable(() -> service.get(SCHEDULE_ID));

        // verifications
        assertThat(failure).isInstanceOf(NotFoundException.class);
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    void requireNameAvailable_existingActiveOrArchivedName_rejectsWithoutWrite() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        List<ScriptStatus> statuses = List.of(ScriptStatus.ACTIVE, ScriptStatus.ARCHIVED);
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(TENANT_ID, "schedule-name", statuses)).thenReturn(true);

        // execution
        Throwable failure = catchThrowable(() -> service.requireNameAvailable("schedule-name"));

        // verifications
        assertThat(failure).isInstanceOf(ConflictException.class);
        verify(scheduleRepository, never()).save(any());
    }
}
