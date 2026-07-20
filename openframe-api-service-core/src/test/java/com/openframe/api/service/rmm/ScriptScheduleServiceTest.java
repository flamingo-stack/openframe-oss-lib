package com.openframe.api.service.rmm;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.rmm.schedule.CreateScriptScheduleInput;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleFilterInput;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleResponse;
import com.openframe.api.dto.rmm.schedule.UpdateScriptScheduleInput;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.ScriptScheduleMapper;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.document.rmm.filter.ScriptScheduleQueryFilter;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Sort;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link ScriptScheduleService}. The repository and tenant
 * provider are mocked (interfaces); the pure {@link ScriptScheduleMapper} is
 * used for real so assertions run end-to-end through the mapping.
 */
class ScriptScheduleServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SCHEDULE_ID = "65f4a8000000000000000001";
    private static final List<ScriptStatus> UNIQUE_STATUSES =
            List.of(ScriptStatus.ACTIVE, ScriptStatus.ARCHIVED);

    private ScriptScheduleRepository scheduleRepository;
    private TenantIdProvider tenantIdProvider;
    private ScriptScheduleService scheduleService;

    private CreateScriptScheduleInput createInput;

    @BeforeEach
    void setUp() {
        scheduleRepository = mock(ScriptScheduleRepository.class);
        tenantIdProvider = mock(TenantIdProvider.class);
        scheduleService = new ScriptScheduleService(scheduleRepository, new ScriptScheduleMapper(), tenantIdProvider);

        createInput = new CreateScriptScheduleInput();
        createInput.setName("Nightly Maintenance");

        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
    }

    private void stubSortDefault() {
        when(scheduleRepository.getDefaultSortField()).thenReturn("_id");
    }

    private static ScriptSchedule active() {
        ScriptSchedule s = new ScriptSchedule();
        s.setId(SCHEDULE_ID);
        s.setStatus(ScriptStatus.ACTIVE);
        return s;
    }

    private static ScriptSchedule withId(String id) {
        ScriptSchedule s = new ScriptSchedule();
        s.setId(id);
        s.setStatus(ScriptStatus.ACTIVE);
        return s;
    }

    @Test
    @DisplayName("create: persists and returns the mapped response when the name is unique, stamping createdBy")
    void create_whenNameUnique_persistsAndReturnsResponse() {
        createInput.setSupportedPlatforms(List.of(ScriptPlatform.WINDOWS));
        createInput.setScriptIds(List.of("sc-1", "sc-2"));
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(TENANT_ID, createInput.getName(), UNIQUE_STATUSES)).thenReturn(false);
        when(scheduleRepository.save(any())).thenAnswer(inv -> {
            ScriptSchedule s = inv.getArgument(0);
            s.setId(SCHEDULE_ID);
            return s;
        });

        ScriptScheduleResponse result = scheduleService.create(createInput, "user-1");

        assertThat(result.getId()).isEqualTo(SCHEDULE_ID);
        assertThat(result.getName()).isEqualTo("Nightly Maintenance");
        assertThat(result.getCreatedBy()).isEqualTo("user-1");
        assertThat(result.getScriptIds()).containsExactly("sc-1", "sc-2");
        assertThat(result.getSupportedPlatforms()).containsExactly("WINDOWS");
        assertThat(result.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("create: throws ConflictException when a schedule with the same name already exists")
    void create_whenNameExists_throwsConflict() {
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(TENANT_ID, createInput.getName(), UNIQUE_STATUSES)).thenReturn(true);

        assertThatThrownBy(() -> scheduleService.create(createInput, "user-1"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining(createInput.getName());

        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("get: returns the mapped response when the schedule exists and is visible")
    void get_whenExists_returnsResponse() {
        ScriptSchedule entity = active();
        entity.setName("Nightly");
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(entity));

        ScriptScheduleResponse result = scheduleService.get(SCHEDULE_ID);

        assertThat(result.getId()).isEqualTo(SCHEDULE_ID);
        assertThat(result.getName()).isEqualTo("Nightly");
    }

    @Test
    @DisplayName("get: throws NotFoundException when the schedule does not exist")
    void get_whenMissing_throwsNotFound() {
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> scheduleService.get(SCHEDULE_ID)).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("get: throws NotFoundException when the schedule is soft-deleted (invisible from the API surface)")
    void get_whenDeleted_throwsNotFound() {
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(deleted()));
        assertThatThrownBy(() -> scheduleService.get(SCHEDULE_ID)).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("findById: empty for a soft-deleted schedule (does not throw, unlike get)")
    void findById_whenDeleted_returnsEmpty() {
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(deleted()));
        assertThat(scheduleService.findById(SCHEDULE_ID)).isEmpty();
    }

    @Test
    @DisplayName("list: forward first page fetches limit+1, drops the sentinel, reports hasNextPage + filteredCount")
    void list_forwardFirstPage_dropsSentinelAndExposesCount() {
        stubSortDefault();
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder().limit(2).cursor(null).backward(false).build();

        when(scheduleRepository.countForTenant(eq(TENANT_ID), any(), eq(null))).thenReturn(5L);
        when(scheduleRepository.findPageForTenant(eq(TENANT_ID), any(), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq(null), eq(false), eq(3)))
                .thenReturn(List.of(withId("id-1"), withId("id-2"), withId("id-3")));

        CountedGenericQueryResult<ScriptScheduleResponse> result = scheduleService.list(null, null, null, criteria);

        assertThat(result.getItems()).extracting(ScriptScheduleResponse::getId).containsExactly("id-1", "id-2");
        assertThat(result.getPageInfo().isHasNextPage()).isTrue();
        assertThat(result.getPageInfo().isHasPreviousPage()).isFalse();
        assertThat(result.getFilteredCount()).isEqualTo(5);
    }

    @Test
    @DisplayName("list: API filter is translated into a data-layer ScriptScheduleQueryFilter and forwarded")
    void list_filterForwardedToRepository() {
        stubSortDefault();
        ScriptScheduleFilterInput filter = ScriptScheduleFilterInput.builder()
                .statuses(List.of(ScriptStatus.ACTIVE))
                .supportedPlatforms(List.of(ScriptPlatform.WINDOWS))
                .authorIds(List.of("user-7"))
                .build();
        when(scheduleRepository.countForTenant(eq(TENANT_ID), any(), any())).thenReturn(0L);
        when(scheduleRepository.findPageForTenant(any(), any(), any(), any(), any(), any(), eq(false), eq(21)))
                .thenReturn(List.of());

        scheduleService.list(filter, "night", null, CursorPaginationCriteria.builder().limit(20).build());

        ArgumentCaptor<ScriptScheduleQueryFilter> captor = ArgumentCaptor.forClass(ScriptScheduleQueryFilter.class);
        verify(scheduleRepository).findPageForTenant(eq(TENANT_ID), captor.capture(), eq("night"),
                eq("_id"), eq(Sort.Direction.DESC), eq(null), eq(false), eq(21));
        ScriptScheduleQueryFilter forwarded = captor.getValue();
        assertThat(forwarded.getStatuses()).containsExactly(ScriptStatus.ACTIVE);
        assertThat(forwarded.getSupportedPlatforms()).containsExactly(ScriptPlatform.WINDOWS);
        assertThat(forwarded.getCreatedByIds()).containsExactly("user-7");
    }

    @Test
    @DisplayName("list: sort by repeat ASC is validated against the allowlist and forwarded verbatim to the repository")
    void list_sortByRepeatAscending_forwarded() {
        when(scheduleRepository.isSortableField("repeat")).thenReturn(true);
        when(scheduleRepository.countForTenant(any(), any(), any())).thenReturn(0L);
        when(scheduleRepository.findPageForTenant(any(), any(), any(), any(), any(), any(), eq(false), anyInt()))
                .thenReturn(List.of());

        scheduleService.list(null, null,
                SortInput.builder().field("repeat").direction(SortDirection.ASC).build(),
                CursorPaginationCriteria.builder().limit(20).build());

        verify(scheduleRepository).findPageForTenant(
                eq(TENANT_ID), any(), any(), eq("repeat"), eq(Sort.Direction.ASC), eq(null), eq(false), eq(21));
        // Allowlisted → the default sort field is never consulted.
        verify(scheduleRepository, never()).getDefaultSortField();
    }

    @Test
    @DisplayName("list: sort by repeat defaults to DESC when no direction is given")
    void list_sortByRepeatDefaultsToDescending() {
        when(scheduleRepository.isSortableField("repeat")).thenReturn(true);
        when(scheduleRepository.countForTenant(any(), any(), any())).thenReturn(0L);
        when(scheduleRepository.findPageForTenant(any(), any(), any(), any(), any(), any(), eq(false), anyInt()))
                .thenReturn(List.of());

        scheduleService.list(null, null,
                SortInput.builder().field("repeat").build(),
                CursorPaginationCriteria.builder().limit(20).build());

        verify(scheduleRepository).findPageForTenant(
                any(), any(), any(), eq("repeat"), eq(Sort.Direction.DESC), any(), eq(false), anyInt());
    }

    @Test
    @DisplayName("list: page cursors are built for the ACTIVE sort field — repeat rows yield the compound cursor, not a bare id")
    void list_sortByRepeat_buildsCompoundCursors() {
        ScriptSchedule first = active();
        first.setRepeat(604800L);
        ScriptSchedule last = active();
        last.setId("65f4a8000000000000000002");
        last.setRepeat(1800L);

        when(scheduleRepository.isSortableField("repeat")).thenReturn(true);
        when(scheduleRepository.countForTenant(any(), any(), any())).thenReturn(2L);
        when(scheduleRepository.findPageForTenant(any(), any(), any(), any(), any(), any(), eq(false), anyInt()))
                .thenReturn(List.of(first, last));
        when(scheduleRepository.encodeCursor(first, "repeat")).thenReturn("604800|" + first.getId());
        when(scheduleRepository.encodeCursor(last, "repeat")).thenReturn("1800|" + last.getId());

        CountedGenericQueryResult<ScriptScheduleResponse> result = scheduleService.list(null, null,
                SortInput.builder().field("repeat").build(),
                CursorPaginationCriteria.builder().limit(20).build());

        // Cursors must come from the repository (which owns the keyset format) and be
        // built from the ENTITIES under the active sort field.
        verify(scheduleRepository).encodeCursor(first, "repeat");
        verify(scheduleRepository).encodeCursor(last, "repeat");
        assertThat(CursorCodec.decode(result.getPageInfo().getStartCursor()))
                .isEqualTo("604800|" + first.getId());
        assertThat(CursorCodec.decode(result.getPageInfo().getEndCursor()))
                .isEqualTo("1800|" + last.getId());
    }

    @Test
    @DisplayName("list: an invalid sort field falls back to the repository default (no exception)")
    void list_invalidSortField_fallsBackToDefault() {
        stubSortDefault();
        when(scheduleRepository.isSortableField("bogus")).thenReturn(false);
        when(scheduleRepository.countForTenant(any(), any(), any())).thenReturn(0L);
        when(scheduleRepository.findPageForTenant(any(), any(), any(), eq("_id"), any(), any(), eq(false), anyInt()))
                .thenReturn(List.of());

        scheduleService.list(null, null,
                SortInput.builder().field("bogus").build(),
                CursorPaginationCriteria.builder().limit(20).build());

        verify(scheduleRepository).findPageForTenant(any(), any(), any(), eq("_id"), any(), any(), eq(false), anyInt());
    }

    @Test
    @DisplayName("update: overwrites fields (PUT), saves, and returns the mapped response")
    void update_whenExists_overwritesAndSaves() {
        UpdateScriptScheduleInput input = new UpdateScriptScheduleInput();
        input.setId(SCHEDULE_ID);
        input.setName("Renamed");
        ScriptSchedule existing = active();
        existing.setName("Old");
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(existing));
        when(scheduleRepository.existsByTenantIdAndNameAndIdNotAndStatusIn(TENANT_ID, "Renamed", SCHEDULE_ID, UNIQUE_STATUSES)).thenReturn(false);
        when(scheduleRepository.save(existing)).thenReturn(existing);

        ScriptScheduleResponse result = scheduleService.update(input);

        assertThat(existing.getName()).isEqualTo("Renamed");
        assertThat(result.getName()).isEqualTo("Renamed");
        verify(scheduleRepository).save(existing);
    }

    @Test
    @DisplayName("update: throws ConflictException when the new name collides with another schedule")
    void update_renameCollision_throwsConflict() {
        UpdateScriptScheduleInput input = new UpdateScriptScheduleInput();
        input.setId(SCHEDULE_ID);
        input.setName("Taken");
        ScriptSchedule existing = active();
        existing.setName("Old");
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(existing));
        when(scheduleRepository.existsByTenantIdAndNameAndIdNotAndStatusIn(TENANT_ID, "Taken", SCHEDULE_ID, UNIQUE_STATUSES)).thenReturn(true);

        assertThatThrownBy(() -> scheduleService.update(input)).isInstanceOf(ConflictException.class);
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("update: keeping the same name skips the uniqueness check (no extra repository round-trip)")
    void update_sameName_skipsUniquenessCheck() {
        UpdateScriptScheduleInput input = new UpdateScriptScheduleInput();
        input.setId(SCHEDULE_ID);
        input.setName("Same");
        ScriptSchedule existing = active();
        existing.setName("Same");
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(existing));
        when(scheduleRepository.save(existing)).thenReturn(existing);

        scheduleService.update(input);

        verify(scheduleRepository, never()).existsByTenantIdAndNameAndIdNotAndStatusIn(any(), any(), any(), any());
    }

    @Test
    @DisplayName("delete: soft-deletes (status DELETED + statusChangedAt) via save, not hard-delete")
    void delete_softDeletes() {
        ScriptSchedule active = active();
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(active));
        when(scheduleRepository.save(active)).thenReturn(active);

        assertThat(scheduleService.delete(SCHEDULE_ID)).isEqualTo(SCHEDULE_ID);
        assertThat(active.getStatus()).isEqualTo(ScriptStatus.DELETED);
        assertThat(active.getStatusChangedAt()).isNotNull();
        verify(scheduleRepository).save(active);
    }

    @Test
    @DisplayName("delete: already-deleted schedule is an idempotent no-op (no save)")
    void delete_alreadyDeleted_isNoOp() {
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(deleted()));

        assertThat(scheduleService.delete(SCHEDULE_ID)).isEqualTo(SCHEDULE_ID);
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("archive: an ACTIVE schedule becomes ARCHIVED, stamped and saved")
    void archive_setsArchived() {
        ScriptSchedule active = active();
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(active));
        when(scheduleRepository.save(active)).thenReturn(active);

        scheduleService.archive(SCHEDULE_ID);

        assertThat(active.getStatus()).isEqualTo(ScriptStatus.ARCHIVED);
        assertThat(active.getStatusChangedAt()).isNotNull();
        verify(scheduleRepository).save(active);
    }

    @Test
    @DisplayName("recordManualRun: only lastRunAt moves — nextRunAt keeps the slot the schedule was already heading for")
    void recordManualRun_doesNotTouchNextRun() {
        ScriptSchedule active = active();
        active.setRepeat(7200L);                                        // 2 h
        Instant plannedNext = Instant.parse("2026-07-17T10:00:00Z");
        active.setNextRunAt(plannedNext);
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(active));

        // "Run now" at an arbitrary 09:17 — an extra run, not a replacement for the planned one.
        Instant runAt = Instant.parse("2026-07-17T09:17:00Z");
        scheduleService.recordManualRun(SCHEDULE_ID, runAt);

        assertThat(active.getLastRunAt()).isEqualTo(runAt);
        assertThat(active.getNextRunAt()).isEqualTo(plannedNext);        // untouched
        verify(scheduleRepository).save(active);
    }

    @Test
    @DisplayName("recordManualRun: a one-shot schedule keeps its null nextRunAt — a manual run never revives it")
    void recordManualRun_oneShotStaysUnscheduled() {
        ScriptSchedule active = active();
        active.setRepeat(null);
        active.setNextRunAt(null);
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(active));

        scheduleService.recordManualRun(SCHEDULE_ID, Instant.parse("2026-07-17T09:17:00Z"));

        assertThat(active.getNextRunAt()).isNull();
        assertThat(active.getLastRunAt()).isEqualTo(Instant.parse("2026-07-17T09:17:00Z"));
    }

    @Test
    @DisplayName("recordManualRun: soft-deleted schedule throws, nothing saved")
    void recordManualRun_deletedThrows() {
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(deleted()));

        assertThatThrownBy(() -> scheduleService.recordManualRun(SCHEDULE_ID, Instant.now()))
                .isInstanceOf(NotFoundException.class);
        verify(scheduleRepository, never()).save(any());
    }

    // ---- half-hour grid (xx:00 / xx:30) ----

    @Test
    @DisplayName("create: startAt off the 30-minute grid is rejected — the runner only ticks at xx:00/xx:30")
    void create_startAtOffGrid_rejected() {
        createInput.setStartAt(Instant.parse("2026-09-15T02:07:00Z"));
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> scheduleService.create(createInput, "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("30-minute boundary");
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: both xx:00 and xx:30 are accepted")
    void create_startAtOnGrid_accepted() {
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);
        when(scheduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        for (String iso : List.of("2026-09-15T02:00:00Z", "2026-09-15T02:30:00Z")) {
            createInput.setStartAt(Instant.parse(iso));
            ScriptScheduleResponse result = scheduleService.create(createInput, "user-1");
            assertThat(result.getStartAt()).isEqualTo(Instant.parse(iso));
        }
    }

    @Test
    @DisplayName("create: repeat that is not a whole number of 30-minute slots is rejected")
    void create_repeatNotSlotMultiple_rejected() {
        createInput.setStartAt(Instant.parse("2026-09-15T02:00:00Z"));
        createInput.setRepeat(2700L);   // 45 min — above the floor, but off the grid
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> scheduleService.create(createInput, "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("30-minute slots");
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: 30m / 1h / 1h30 / 2h repeats are accepted")
    void create_repeatSlotMultiples_accepted() {
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);
        when(scheduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        createInput.setStartAt(Instant.parse("2026-09-15T02:00:00Z"));

        for (long repeat : List.of(1800L, 3600L, 5400L, 7200L)) {
            createInput.setRepeat(repeat);
            assertThat(scheduleService.create(createInput, "user-1").getRepeat()).isEqualTo(repeat);
        }
    }



    private static ScriptSchedule deleted() {
        ScriptSchedule s = new ScriptSchedule();
        s.setId(SCHEDULE_ID);
        s.setStatus(ScriptStatus.DELETED);
        return s;
    }
}
