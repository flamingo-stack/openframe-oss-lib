package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.script.ScriptFilterOption;
import com.openframe.api.dto.rmm.software.SoftwareActionFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareActionFilters;
import com.openframe.api.dto.rmm.software.SoftwareActionResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.api.mapper.ScriptFilterOptionMapper;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.filter.SoftwareActionQueryFilter;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareSchedulePackage;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionKind;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareActionSummary;
import com.openframe.data.document.rmm.software.SoftwareExecutionId;
import com.openframe.data.repository.rmm.SoftwareActionAggregationRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareActionServiceTest {

    private static final String TENANT = "t1";
    private static final Instant T0 = Instant.parse("2026-10-28T23:30:00Z");
    private static final Instant HOUR_AHEAD = Instant.now().plusSeconds(3600);
    private static final String SCHEDULED_EXECUTION =
            SoftwareExecutionId.forSchedule("s1", PackageManagerType.BREW, "slack");

    @Mock private SoftwareActionAggregationRepository aggregationRepository;
    @Mock private SoftwareScheduleRepository scheduleRepository;
    @Mock private SoftwareScheduleMachineAssignedRepository assignedRepository;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private SoftwareScheduleTargetResolver softwareScheduleTargetResolver;

    private final ScriptFilterOptionMapper optionMapper = new ScriptFilterOptionMapper(null, null);

    private SoftwareActionService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareActionService(aggregationRepository, scheduleRepository, assignedRepository, optionMapper, tenantIdProvider,
                softwareScheduleTargetResolver);
        lenient().when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
    }

    @Test
    @DisplayName("list: executed rows come from the leaf aggregation with derived status + X/Y")
    void list_executedRows() {
        when(scheduleRepository.findByTenantIdAndStatusAndNextRunAtGreaterThanOrderByNextRunAtAsc(eq(TENANT), eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of());
        when(aggregationRepository.count(eq(TENANT), any(), any())).thenReturn(1L);
        SoftwareActionSummary autoUpdate = summary("exec-1", PackageManagerType.BREW, "slack",
                SoftwareAction.UPDATE, SoftwareActionStatus.FAILED, 7, 4);
        autoUpdate.setKind(SoftwareActionKind.AUTO_UPDATE);
        Instant finishedAt = Instant.parse("2026-10-29T00:08:00Z");
        autoUpdate.setFinishedAt(finishedAt);
        when(aggregationRepository.findPage(eq(TENANT), any(), any(), eq("dispatchedAt"), eq(Sort.Direction.DESC), eq(0), eq(25)))
                .thenReturn(List.of(autoUpdate));

        PageResult<SoftwareActionResponse> result = service.list(null, null, null, 0, 25);

        assertThat(result.filteredCount()).isEqualTo(1);
        SoftwareActionResponse row = result.items().get(0);
        assertThat(row.getSoftware()).isEqualTo("slack");
        assertThat(row.getAction()).isEqualTo(SoftwareAction.UPDATE);
        assertThat(row.getKind()).isEqualTo(SoftwareActionKind.AUTO_UPDATE);
        assertThat(row.getEngine()).isEqualTo(PackageManagerType.BREW);
        assertThat(row.getStatus()).isEqualTo(SoftwareActionStatus.FAILED);
        assertThat(row.getTotalMachineCount()).isEqualTo(7);
        assertThat(row.getRespondedMachineCount()).isEqualTo(4);
        assertThat(row.getFinishedAt()).isEqualTo(finishedAt);
    }

    @Test
    @DisplayName("list: upcoming schedules appear as SCHEDULED rows (0/Y), merged with executed")
    void list_mergesScheduledRows() {
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
        when(aggregationRepository.findPage(eq(TENANT), any(), any(), any(), any(), eq(0), eq(25)))
                .thenReturn(List.of());

        PageResult<SoftwareActionResponse> result = service.list(null, null, null, 0, 25);

        assertThat(result.filteredCount()).isEqualTo(1);
        SoftwareActionResponse row = result.items().get(0);
        assertThat(row.getStatus()).isEqualTo(SoftwareActionStatus.SCHEDULED);
        assertThat(row.getKind()).isEqualTo(SoftwareActionKind.INSTALL);
        assertThat(row.getSoftware()).isEqualTo("crowdstrike");
        assertThat(row.getTotalMachineCount()).isEqualTo(7);
        assertThat(row.getRespondedMachineCount()).isZero();
        assertThat(row.getScheduledAt()).isNotNull();
    }

    @Test
    @DisplayName("list: a device-time schedule is SCHEDULED until its time passed in the last time zone")
    void list_deviceTimeSchedule_scheduledWhileAheadOnSomeDevice() {
        Instant now = Instant.now();
        Instant aheadSomewhere = now.minusSeconds(3600);
        Instant passedEverywhere = now.minusSeconds(13 * 3600);
        SoftwareSchedule ahead = deviceTimeSchedule("ahead", aheadSomewhere);
        when(scheduleRepository.findByTenantIdAndStatusAndTriggerAndTimeReference(TENANT, ScriptStatus.ACTIVE,
                ScheduleScriptTrigger.DATE_TIME, ScheduleTimeReference.DEVICE_LOCAL))
                .thenReturn(List.of(ahead, deviceTimeSchedule("passed", passedEverywhere)));
        when(softwareScheduleTargetResolver.resolveMachineIdsAwaitingDeviceTime(List.of(ahead)))
                .thenReturn(Map.of("ahead", List.of("m1")));
        when(assignedRepository.countByTenantIdAndSoftwareScheduleId(TENANT, "ahead")).thenReturn(3L);
        when(aggregationRepository.count(eq(TENANT), any(), any())).thenReturn(0L);

        PageResult<SoftwareActionResponse> result = service.list(null, null, null, 0, 25);

        assertThat(result.items()).extracting(SoftwareActionResponse::getScheduleId).containsExactly("ahead");
        SoftwareActionResponse row = result.items().get(0);
        assertThat(row.getStatus()).isEqualTo(SoftwareActionStatus.SCHEDULED);
        assertThat(row.getScheduledAt()).isEqualTo(aheadSomewhere);
        assertThat(row.getTimeReference()).isEqualTo(ScheduleTimeReference.DEVICE_LOCAL);
        assertThat(row.getTotalMachineCount()).isEqualTo(3);
    }

    @Test
    @DisplayName("list: a repeating device-time schedule shows its next run, not the first one")
    void list_repeatingDeviceTimeSchedule_showsTheNextRun() {
        Instant firstRun = Instant.now().minusSeconds(3 * 86400 + 600);
        SoftwareSchedule daily = deviceTimeSchedule("daily", firstRun);
        daily.setRepeat(86400L);
        when(scheduleRepository.findByTenantIdAndStatusAndTriggerAndTimeReference(TENANT, ScriptStatus.ACTIVE,
                ScheduleScriptTrigger.DATE_TIME, ScheduleTimeReference.DEVICE_LOCAL)).thenReturn(List.of(daily));
        when(softwareScheduleTargetResolver.resolveMachineIdsAwaitingDeviceTime(List.of(daily)))
                .thenReturn(Map.of("daily", List.of("m1")));
        when(aggregationRepository.count(eq(TENANT), any(), any())).thenReturn(0L);

        PageResult<SoftwareActionResponse> result = service.list(null, null, null, 0, 25);

        assertThat(result.items().get(0).getScheduledAt()).isEqualTo(firstRun.plusSeconds(4 * 86400));
    }

    @Test
    void list_oneOffDeviceTimeScheduleEveryDeviceRan_noScheduledRow() {
        // setup
        SoftwareSchedule ran = deviceTimeSchedule("ran", Instant.now().minusSeconds(3600));
        when(scheduleRepository.findByTenantIdAndStatusAndTriggerAndTimeReference(TENANT, ScriptStatus.ACTIVE,
                ScheduleScriptTrigger.DATE_TIME, ScheduleTimeReference.DEVICE_LOCAL)).thenReturn(List.of(ran));
        when(softwareScheduleTargetResolver.resolveMachineIdsAwaitingDeviceTime(List.of(ran)))
                .thenReturn(Map.of("ran", List.of()));
        when(aggregationRepository.count(TENANT, null, null)).thenReturn(0L);
        when(aggregationRepository.findPage(TENANT, null, null, "dispatchedAt", Sort.Direction.DESC, 0, 25))
                .thenReturn(List.of());

        // execution
        PageResult<SoftwareActionResponse> result = service.list(null, null, null, 0, 25);

        // verifications
        assertThat(result.items()).isEmpty();
        assertThat(result.filteredCount()).isZero();
    }

    @Test
    void list_oneOffDeviceTimeScheduleOneDeviceStillWaits_scheduledRowShown() {
        // setup
        SoftwareSchedule waits = deviceTimeSchedule("waits", Instant.now().minusSeconds(3600));
        when(scheduleRepository.findByTenantIdAndStatusAndTriggerAndTimeReference(TENANT, ScriptStatus.ACTIVE,
                ScheduleScriptTrigger.DATE_TIME, ScheduleTimeReference.DEVICE_LOCAL)).thenReturn(List.of(waits));
        when(softwareScheduleTargetResolver.resolveMachineIdsAwaitingDeviceTime(List.of(waits)))
                .thenReturn(Map.of("waits", List.of("m2")));
        when(assignedRepository.countByTenantIdAndSoftwareScheduleId(TENANT, "waits")).thenReturn(2L);
        when(aggregationRepository.count(TENANT, null, null)).thenReturn(0L);

        // execution
        PageResult<SoftwareActionResponse> result = service.list(null, null, null, 0, 25);

        // verifications
        assertThat(result.items())
                .extracting(SoftwareActionResponse::getScheduleId, SoftwareActionResponse::getStatus,
                        SoftwareActionResponse::getTotalMachineCount)
                .containsExactly(tuple("waits", SoftwareActionStatus.SCHEDULED, 2));
    }

    @Test
    void list_serverTimeSchedule_shownWithoutAskingWhichDevicesRan() {
        // setup
        SoftwareSchedule serverTime = SoftwareSchedule.builder()
                .id("s1").tenantId(TENANT).action(SoftwareAction.UPDATE)
                .nextRunAt(Instant.now().plusSeconds(3600))
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.WINGET).packageName("Microsoft.PowerShell").build()))
                .build();
        when(scheduleRepository.findByTenantIdAndStatusAndNextRunAtGreaterThanOrderByNextRunAtAsc(eq(TENANT),
                eq(ScriptStatus.ACTIVE), any(Instant.class))).thenReturn(List.of(serverTime));
        when(assignedRepository.countByTenantIdAndSoftwareScheduleId(TENANT, "s1")).thenReturn(1L);
        when(aggregationRepository.count(TENANT, null, null)).thenReturn(0L);
        when(aggregationRepository.findPage(TENANT, null, null, "dispatchedAt", Sort.Direction.DESC, 0, 25))
                .thenReturn(List.of());

        // execution
        PageResult<SoftwareActionResponse> result = service.list(null, null, null, 0, 25);

        // verifications
        assertThat(result.items()).extracting(SoftwareActionResponse::getScheduleId).containsExactly("s1");
        verify(softwareScheduleTargetResolver).resolveMachineIdsAwaitingDeviceTime(List.of());
    }

    private static SoftwareSchedule deviceTimeSchedule(String id, Instant startAt) {
        return SoftwareSchedule.builder()
                .id(id).tenantId(TENANT).action(SoftwareAction.UPDATE)
                .timeReference(ScheduleTimeReference.DEVICE_LOCAL)
                .startAt(startAt)
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.BREW).packageName("slack").build()))
                .build();
    }

    @Test
    @DisplayName("filters: executed facets merge with scheduled tallies; SCHEDULED comes only from schedules")
    void filters_mergeExecutedAndScheduled() {
        when(aggregationRepository.facet(eq(TENANT), any(), any(), eq("status")))
                .thenReturn(new java.util.LinkedHashMap<>(java.util.Map.of("COMPLETED", 3, "FAILED", 1)));
        when(aggregationRepository.facet(eq(TENANT), any(), any(), eq("action")))
                .thenReturn(new java.util.LinkedHashMap<>(java.util.Map.of("UPDATE", 4)));
        when(aggregationRepository.facet(eq(TENANT), any(), any(), eq("kind")))
                .thenReturn(new java.util.LinkedHashMap<>(java.util.Map.of("UPDATE", 3, "AUTO_UPDATE", 1)));
        when(aggregationRepository.facet(eq(TENANT), any(), any(), eq("packageManager")))
                .thenReturn(new java.util.LinkedHashMap<>(java.util.Map.of("BREW", 4)));
        when(aggregationRepository.count(eq(TENANT), any(), any())).thenReturn(4L);

        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("s1").tenantId(TENANT).createdBy("user-1").action(SoftwareAction.INSTALL)
                .nextRunAt(Instant.now().plusSeconds(3600))
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.WINGET).packageName("chrome").build()))
                .build();
        when(scheduleRepository.findByTenantIdAndStatusAndNextRunAtGreaterThanOrderByNextRunAtAsc(eq(TENANT), eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(schedule));
        when(assignedRepository.countByTenantIdAndSoftwareScheduleId(TENANT, "s1")).thenReturn(7L);

        SoftwareActionFilters filters = service.filters(null, null);

        assertThat(count(filters.getStatuses(), "COMPLETED")).isEqualTo(3);
        assertThat(count(filters.getStatuses(), "FAILED")).isEqualTo(1);
        assertThat(count(filters.getStatuses(), "SCHEDULED")).isEqualTo(1); // only from the schedule
        assertThat(count(filters.getActions(), "UPDATE")).isEqualTo(4);
        assertThat(count(filters.getActions(), "INSTALL")).isEqualTo(1);    // from the schedule
        assertThat(count(filters.getKinds(), "UPDATE")).isEqualTo(3);
        assertThat(count(filters.getKinds(), "AUTO_UPDATE")).isEqualTo(1);
        assertThat(count(filters.getKinds(), "INSTALL")).isEqualTo(1);      // from the schedule
        assertThat(count(filters.getEngines(), "BREW")).isEqualTo(4);
        assertThat(count(filters.getEngines(), "WINGET")).isEqualTo(1);     // from the schedule
        assertThat(filters.getFilteredCount()).isEqualTo(5);               // 4 executed + 1 scheduled
    }

    @Test
    @DisplayName("list: a kinds filter keeps out the schedules of another kind and reaches the aggregation")
    void list_kindsFilter_excludesOtherScheduledKinds() {
        SoftwareSchedule install = SoftwareSchedule.builder()
                .id("s1").tenantId(TENANT).action(SoftwareAction.INSTALL)
                .nextRunAt(Instant.now().plusSeconds(3600))
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.BREW).packageName("crowdstrike").build()))
                .build();
        when(scheduleRepository.findByTenantIdAndStatusAndNextRunAtGreaterThanOrderByNextRunAtAsc(eq(TENANT), eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(install));
        when(aggregationRepository.count(eq(TENANT), any(), any())).thenReturn(0L);
        when(aggregationRepository.findPage(eq(TENANT), any(), any(), any(), any(), eq(0), eq(25))).thenReturn(List.of());
        SoftwareActionFilterInput filter = new SoftwareActionFilterInput();
        filter.setKinds(List.of(SoftwareActionKind.UPDATE));

        PageResult<SoftwareActionResponse> result = service.list(filter, null, null, 0, 25);

        assertThat(result.items()).isEmpty();
        ArgumentCaptor<SoftwareActionQueryFilter> query = ArgumentCaptor.forClass(SoftwareActionQueryFilter.class);
        verify(aggregationRepository).count(eq(TENANT), query.capture(), any());
        assertThat(query.getValue().getKinds()).containsExactly(SoftwareActionKind.UPDATE);
    }

    @Test
    void list_unknownSortField_rejected() {
        // setup
        SortInput sort = sort("hostname", SortDirection.ASC);

        // execution
        Throwable thrown = catchThrowable(() -> service.list(null, null, sort, 0, 25));

        // verifications
        assertThat(thrown).isInstanceOf(BadRequestException.class).hasMessageContaining("hostname");
        verifyNoInteractions(aggregationRepository);
    }

    @Test
    void list_processedDevicesSort_sortsExecutedRowsByRespondedMachineCount() {
        // setup
        when(aggregationRepository.count(TENANT, null, null)).thenReturn(0L);
        SortInput sort = sort("processedDevices", SortDirection.ASC);

        // execution
        service.list(null, null, sort, 0, 25);

        // verifications
        verify(aggregationRepository).findPage(TENANT, null, null, "respondedMachineCount", Sort.Direction.ASC, 0, 25);
    }

    @Test
    void list_statusSortAscending_scheduledRowBetweenInProgressAndCompleted() {
        // setup
        upcoming(schedule("s1", "slack", HOUR_AHEAD));
        when(aggregationRepository.count(TENANT, null, null)).thenReturn(4L);
        when(aggregationRepository.findPage(TENANT, null, null, "status", Sort.Direction.ASC, 0, 25)).thenReturn(List.of(
                executed("exec-failed", "slack", SoftwareActionStatus.FAILED, 1, 1, T0),
                executed("exec-waiting", "slack", SoftwareActionStatus.WAITING, 0, 1, T0),
                executed("exec-progress", "slack", SoftwareActionStatus.IN_PROGRESS, 0, 1, T0),
                executed("exec-completed", "slack", SoftwareActionStatus.COMPLETED, 1, 1, T0)));

        // execution
        PageResult<SoftwareActionResponse> result = service.list(null, null, sort("status", SortDirection.ASC), 0, 25);

        // verifications
        assertThat(result.items()).extracting(SoftwareActionResponse::getStatus).containsExactly(
                SoftwareActionStatus.FAILED, SoftwareActionStatus.WAITING, SoftwareActionStatus.IN_PROGRESS,
                SoftwareActionStatus.SCHEDULED, SoftwareActionStatus.COMPLETED);
    }

    @Test
    void list_statusSortDescending_scheduledRowAfterCompleted() {
        // setup
        upcoming(schedule("s1", "slack", HOUR_AHEAD));
        when(aggregationRepository.count(TENANT, null, null)).thenReturn(2L);
        when(aggregationRepository.findPage(TENANT, null, null, "status", Sort.Direction.DESC, 0, 25)).thenReturn(List.of(
                executed("exec-completed", "slack", SoftwareActionStatus.COMPLETED, 1, 1, T0),
                executed("exec-failed", "slack", SoftwareActionStatus.FAILED, 1, 1, T0)));

        // execution
        PageResult<SoftwareActionResponse> result = service.list(null, null, sort("status", SortDirection.DESC), 0, 25);

        // verifications
        assertThat(result.items()).extracting(SoftwareActionResponse::getStatus).containsExactly(
                SoftwareActionStatus.COMPLETED, SoftwareActionStatus.SCHEDULED, SoftwareActionStatus.FAILED);
    }

    @Test
    void list_processedDevicesSort_scheduledRowOrderedByProcessedThenTotal() {
        // setup
        upcoming(schedule("s1", "slack", HOUR_AHEAD));
        when(assignedRepository.countByTenantIdAndSoftwareScheduleId(TENANT, "s1")).thenReturn(7L);
        when(aggregationRepository.count(TENANT, null, null)).thenReturn(3L);
        when(aggregationRepository.findPage(TENANT, null, null, "respondedMachineCount", Sort.Direction.ASC, 0, 25))
                .thenReturn(List.of(
                        executed("exec-0-of-3", "slack", SoftwareActionStatus.IN_PROGRESS, 0, 3, T0),
                        executed("exec-0-of-9", "slack", SoftwareActionStatus.IN_PROGRESS, 0, 9, T0),
                        executed("exec-2-of-5", "slack", SoftwareActionStatus.IN_PROGRESS, 2, 5, T0)));

        // execution
        PageResult<SoftwareActionResponse> result = service.list(null, null, sort("processedDevices", SortDirection.ASC), 0, 25);

        // verifications
        assertThat(result.items()).extracting(SoftwareActionResponse::getExecutionId).containsExactly(
                "exec-0-of-3", SCHEDULED_EXECUTION, "exec-0-of-9", "exec-2-of-5");
    }

    @Test
    void list_softwareSortTie_brokenOnDispatchTimeInRequestedDirection() {
        // setup
        upcoming(schedule("s1", "slack", HOUR_AHEAD));
        when(aggregationRepository.count(TENANT, null, null)).thenReturn(1L);
        when(aggregationRepository.findPage(TENANT, null, null, "packageName", Sort.Direction.ASC, 0, 25))
                .thenReturn(List.of(executed("exec-slack", "slack", SoftwareActionStatus.COMPLETED, 1, 1, T0)));

        // execution
        PageResult<SoftwareActionResponse> result = service.list(null, null, sort("software", SortDirection.ASC), 0, 25);

        // verifications
        assertThat(result.items()).extracting(SoftwareActionResponse::getExecutionId)
                .containsExactly("exec-slack", SCHEDULED_EXECUTION);
    }

    @Test
    void list_secondPageScheduledRowSortedBeforeIt_pageHoldsTheNextExecutedRows() {
        // setup
        upcoming(schedule("s1", "b", HOUR_AHEAD));
        when(aggregationRepository.count(TENANT, null, null)).thenReturn(4L);
        when(aggregationRepository.findPage(TENANT, null, null, "packageName", Sort.Direction.ASC, 1, 3)).thenReturn(List.of(
                executed("exec-c", "c", SoftwareActionStatus.COMPLETED, 1, 1, T0),
                executed("exec-d", "d", SoftwareActionStatus.COMPLETED, 1, 1, T0),
                executed("exec-e", "e", SoftwareActionStatus.COMPLETED, 1, 1, T0)));

        // execution
        PageResult<SoftwareActionResponse> result = service.list(null, null, sort("software", SortDirection.ASC), 1, 2);

        // verifications
        assertThat(result.items()).extracting(SoftwareActionResponse::getSoftware).containsExactly("c", "d");
        assertThat(result.filteredCount()).isEqualTo(5);
        assertThat(result.hasNext()).isTrue();
    }

    @Test
    void list_secondPageScheduledRowSortedAfterIt_pageHoldsExecutedRowsOnly() {
        // setup
        upcoming(schedule("s1", "z", HOUR_AHEAD));
        when(aggregationRepository.count(TENANT, null, null)).thenReturn(4L);
        when(aggregationRepository.findPage(TENANT, null, null, "packageName", Sort.Direction.ASC, 1, 3)).thenReturn(List.of(
                executed("exec-c", "c", SoftwareActionStatus.COMPLETED, 1, 1, T0),
                executed("exec-d", "d", SoftwareActionStatus.COMPLETED, 1, 1, T0),
                executed("exec-e", "e", SoftwareActionStatus.COMPLETED, 1, 1, T0)));

        // execution
        PageResult<SoftwareActionResponse> result = service.list(null, null, sort("software", SortDirection.ASC), 1, 2);

        // verifications
        assertThat(result.items()).extracting(SoftwareActionResponse::getSoftware).containsExactly("d", "e");
    }

    @Test
    void list_thirdPageScheduledRowsBeforeAndInsideIt_pageHoldsTheRowsAtItsPosition() {
        // setup
        upcoming(schedule("s1", "d", HOUR_AHEAD), schedule("s2", "b", HOUR_AHEAD));
        when(aggregationRepository.count(TENANT, null, null)).thenReturn(4L);
        when(aggregationRepository.findPage(TENANT, null, null, "packageName", Sort.Direction.ASC, 2, 4)).thenReturn(List.of(
                executed("exec-e", "e", SoftwareActionStatus.COMPLETED, 1, 1, T0),
                executed("exec-f", "f", SoftwareActionStatus.COMPLETED, 1, 1, T0)));

        // execution
        PageResult<SoftwareActionResponse> result = service.list(null, null, sort("software", SortDirection.ASC), 2, 2);

        // verifications
        assertThat(result.items()).extracting(SoftwareActionResponse::getSoftware).containsExactly("e", "f");
        assertThat(result.filteredCount()).isEqualTo(6);
        assertThat(result.hasNext()).isFalse();
    }

    @Test
    void list_secondPageScheduledRowsAroundTheWindow_pageHoldsTheRowsAtItsPosition() {
        // setup
        upcoming(schedule("s1", "z", HOUR_AHEAD), schedule("s2", "b", HOUR_AHEAD));
        when(aggregationRepository.count(TENANT, null, null)).thenReturn(4L);
        when(aggregationRepository.findPage(TENANT, null, null, "packageName", Sort.Direction.ASC, 0, 4)).thenReturn(List.of(
                executed("exec-a", "a", SoftwareActionStatus.COMPLETED, 1, 1, T0),
                executed("exec-c", "c", SoftwareActionStatus.COMPLETED, 1, 1, T0),
                executed("exec-d", "d", SoftwareActionStatus.COMPLETED, 1, 1, T0),
                executed("exec-e", "e", SoftwareActionStatus.COMPLETED, 1, 1, T0)));

        // execution
        PageResult<SoftwareActionResponse> result = service.list(null, null, sort("software", SortDirection.ASC), 1, 2);

        // verifications
        assertThat(result.items()).extracting(SoftwareActionResponse::getSoftware).containsExactly("c", "d");
    }

    @Test
    void list_firstPageScheduledRowInsideIt_pageMergesBothKinds() {
        // setup
        upcoming(schedule("s1", "b", HOUR_AHEAD));
        when(aggregationRepository.count(TENANT, null, null)).thenReturn(4L);
        when(aggregationRepository.findPage(TENANT, null, null, "packageName", Sort.Direction.ASC, 0, 2)).thenReturn(List.of(
                executed("exec-a", "a", SoftwareActionStatus.COMPLETED, 1, 1, T0),
                executed("exec-c", "c", SoftwareActionStatus.COMPLETED, 1, 1, T0)));

        // execution
        PageResult<SoftwareActionResponse> result = service.list(null, null, sort("software", SortDirection.ASC), 0, 2);

        // verifications
        assertThat(result.items()).extracting(SoftwareActionResponse::getSoftware).containsExactly("a", "b");
    }

    private void upcoming(SoftwareSchedule... schedules) {
        when(scheduleRepository.findByTenantIdAndStatusAndNextRunAtGreaterThanOrderByNextRunAtAsc(eq(TENANT),
                eq(ScriptStatus.ACTIVE), any(Instant.class))).thenReturn(List.of(schedules));
    }

    private static SoftwareSchedule schedule(String id, String packageName, Instant nextRunAt) {
        return SoftwareSchedule.builder()
                .id(id).tenantId(TENANT).action(SoftwareAction.INSTALL)
                .nextRunAt(nextRunAt)
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.BREW).packageName(packageName).build()))
                .build();
    }

    private static SoftwareActionSummary executed(String executionId, String name, SoftwareActionStatus status,
                                                  int responded, int total, Instant dispatchedAt) {
        SoftwareActionSummary row = summary(executionId, PackageManagerType.BREW, name, SoftwareAction.INSTALL,
                status, total, responded);
        row.setDispatchedAt(dispatchedAt);
        return row;
    }

    private static SortInput sort(String field, SortDirection direction) {
        return SortInput.builder().field(field).direction(direction).build();
    }

    private static int count(List<ScriptFilterOption> options, String value) {
        return options.stream().filter(o -> o.getValue().equals(value)).map(ScriptFilterOption::getCount)
                .findFirst().orElse(0);
    }

    private static SoftwareActionSummary summary(String executionId, PackageManagerType pm, String name,
                                                 SoftwareAction action, SoftwareActionStatus status, int total, int responded) {
        return SoftwareActionSummary.builder()
                .executionId(executionId).packageManager(pm).packageName(name).action(action).status(status)
                .totalMachineCount(total).respondedMachineCount(responded).build();
    }
}
