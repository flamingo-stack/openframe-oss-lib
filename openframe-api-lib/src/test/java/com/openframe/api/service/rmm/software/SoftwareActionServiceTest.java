package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareActionResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareSchedulePackage;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareActionSummary;
import com.openframe.data.repository.rmm.SoftwareActionAggregationRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareActionServiceTest {

    private static final String TENANT = "t1";

    @Mock private SoftwareActionAggregationRepository aggregationRepository;
    @Mock private SoftwareScheduleRepository scheduleRepository;
    @Mock private SoftwareScheduleMachineAssignedRepository assignedRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    private SoftwareActionService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareActionService(aggregationRepository, scheduleRepository, assignedRepository, tenantIdProvider);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(aggregationRepository.getDefaultSortField()).thenReturn("dispatchedAt");
    }

    @Test
    @DisplayName("list: executed rows come from the leaf aggregation with derived status + X/Y")
    void list_executedRows() {
        when(scheduleRepository.findByTenantIdAndStatusAndNextRunAtGreaterThanOrderByNextRunAtAsc(eq(TENANT), eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of());
        when(aggregationRepository.count(eq(TENANT), any(), any())).thenReturn(1L);
        when(aggregationRepository.findPage(eq(TENANT), any(), any(), eq("dispatchedAt"), eq(Sort.Direction.DESC), eq(0), eq(25)))
                .thenReturn(List.of(summary("exec-1", PackageManagerType.BREW, "slack",
                        SoftwareAction.UPDATE, SoftwareActionStatus.FAILED, 7, 4)));

        PageResult<SoftwareActionResponse> result = service.list(null, null, null, 0, 25);

        assertThat(result.filteredCount()).isEqualTo(1);
        SoftwareActionResponse row = result.items().get(0);
        assertThat(row.getSoftware()).isEqualTo("slack");
        assertThat(row.getAction()).isEqualTo(SoftwareAction.UPDATE);
        assertThat(row.getEngine()).isEqualTo(PackageManagerType.BREW);
        assertThat(row.getStatus()).isEqualTo(SoftwareActionStatus.FAILED);
        assertThat(row.getTotalMachineCount()).isEqualTo(7);
        assertThat(row.getRespondedMachineCount()).isEqualTo(4);
    }

    @Test
    @DisplayName("list: upcoming schedules appear as SCHEDULED rows (0/Y) on top, merged with executed")
    void list_mergesScheduledOnTop() {
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("s1").tenantId(TENANT).createdBy("user-1").action(SoftwareAction.INSTALL)
                .nextRunAt(Instant.now().plusSeconds(3600))
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.BREW).packageName("crowdstrike").build()))
                .build();
        when(scheduleRepository.findByTenantIdAndStatusAndNextRunAtGreaterThanOrderByNextRunAtAsc(eq(TENANT), eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(schedule));
        when(assignedRepository.countByTenantIdAndSoftwareScheduleId(TENANT, "s1")).thenReturn(7L);
        when(aggregationRepository.count(eq(TENANT), any(), any())).thenReturn(0L);
        when(aggregationRepository.findPage(eq(TENANT), any(), any(), any(), any(), eq(0), eq(24)))
                .thenReturn(List.of());

        PageResult<SoftwareActionResponse> result = service.list(null, null, null, 0, 25);

        assertThat(result.filteredCount()).isEqualTo(1);
        SoftwareActionResponse row = result.items().get(0);
        assertThat(row.getStatus()).isEqualTo(SoftwareActionStatus.SCHEDULED);
        assertThat(row.getSoftware()).isEqualTo("crowdstrike");
        assertThat(row.getTotalMachineCount()).isEqualTo(7);
        assertThat(row.getRespondedMachineCount()).isZero();
        assertThat(row.getScheduledAt()).isNotNull();
    }

    private static SoftwareActionSummary summary(String executionId, PackageManagerType pm, String name,
                                                 SoftwareAction action, SoftwareActionStatus status, int total, int responded) {
        return SoftwareActionSummary.builder()
                .executionId(executionId).packageManager(pm).packageName(name).action(action).status(status)
                .totalMachineCount(total).respondedMachineCount(responded).build();
    }
}
