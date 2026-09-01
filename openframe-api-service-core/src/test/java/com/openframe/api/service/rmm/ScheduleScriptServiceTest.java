package com.openframe.api.service.rmm;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.rmm.schedule.CreateScriptScheduleInput;
import com.openframe.api.dto.rmm.schedule.ScheduledScriptCustomParamsInput;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleFilterInput;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleResponse;
import com.openframe.api.dto.rmm.schedule.UpdateScriptScheduleInput;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.ScriptScheduleMapper;
import com.openframe.api.service.rmm.schedule.ScheduleScriptService;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.filter.ScriptScheduleQueryFilter;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static com.openframe.data.document.rmm.script.OsType.MAC_OS;
import static com.openframe.data.document.rmm.script.OsType.WINDOWS;
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
 * Unit tests for {@link ScheduleScriptService}. The repository and tenant
 * provider are mocked (interfaces); the pure {@link ScriptScheduleMapper} is
 * used for real so assertions run end-to-end through the mapping.
 */
class ScheduleScriptServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SCHEDULE_ID = "65f4a8000000000000000001";
    private static final List<ScriptStatus> UNIQUE_STATUSES =
            List.of(ScriptStatus.ACTIVE, ScriptStatus.ARCHIVED);

    private ScriptScheduleRepository scheduleRepository;
    private ScriptService scriptService;
    private TenantIdProvider tenantIdProvider;
    private ScheduleScriptService scheduleService;

    private CreateScriptScheduleInput createInput;

    @BeforeEach
    void setUp() {
        scheduleRepository = mock(ScriptScheduleRepository.class);
        scriptService = mock(ScriptService.class);
        tenantIdProvider = mock(TenantIdProvider.class);
        scheduleService = new ScheduleScriptService(scheduleRepository, new ScriptScheduleMapper(), scriptService, tenantIdProvider);

        createInput = new CreateScriptScheduleInput();
        createInput.setName("Nightly Maintenance");
        // Default to a valid DATE_TIME schedule: an on-grid startAt is mandatory for DATE_TIME.
        // DEVICE_ONLINE tests clear this explicitly.
        createInput.setStartAt(Instant.parse("2026-09-15T02:00:00Z"));

        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
    }

    private void stubSortDefault() {
        when(scheduleRepository.getDefaultSortField()).thenReturn("_id");
    }

    private static ScheduleScript active() {
        ScheduleScript s = new ScheduleScript();
        s.setId(SCHEDULE_ID);
        s.setStatus(ScriptStatus.ACTIVE);
        return s;
    }

    private static ScheduleScript withId(String id) {
        ScheduleScript s = new ScheduleScript();
        s.setId(id);
        s.setStatus(ScriptStatus.ACTIVE);
        return s;
    }

    @Test
    @DisplayName("create: persists and returns the mapped response when the name is unique, stamping createdBy")
    void create_whenNameUnique_persistsAndReturnsResponse() {
        createInput.setSupportedPlatforms(List.of(WINDOWS));
        createInput.setScriptIds(List.of("sc-1", "sc-2"));
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(TENANT_ID, createInput.getName(), UNIQUE_STATUSES)).thenReturn(false);
        when(scheduleRepository.save(any())).thenAnswer(inv -> {
            ScheduleScript s = inv.getArgument(0);
            s.setId(SCHEDULE_ID);
            return s;
        });

        ScriptScheduleResponse result = scheduleService.create(createInput, "user-1");

        assertThat(result.getId()).isEqualTo(SCHEDULE_ID);
        assertThat(result.getName()).isEqualTo("Nightly Maintenance");
        assertThat(result.getCreatedBy()).isEqualTo("user-1");
        assertThat(result.getScriptIds()).containsExactly("sc-1", "sc-2");
        assertThat(result.getSupportedPlatforms()).containsExactly(WINDOWS);
        assertThat(result.getStatus()).isEqualTo(ScriptStatus.ACTIVE);
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
    @DisplayName("create: a script whose platforms exclude the schedule's platform is rejected (macOS schedule + Windows-only script)")
    void create_scriptPlatformMismatch_rejected() {
        createInput.setSupportedPlatforms(List.of(MAC_OS));
        createInput.setScriptIds(List.of("sc-win"));
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);
        when(scriptService.getScriptsByIds(any())).thenReturn(List.of(
                ScriptResponse.builder().id("sc-win").name("win-only").supportedPlatforms(List.of(WINDOWS)).build()));

        assertThatThrownBy(() -> scheduleService.create(createInput, "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("win-only");
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: a script that supports the schedule's platform (among others) is accepted")
    void create_scriptPlatformCompatible_accepted() {
        createInput.setSupportedPlatforms(List.of(MAC_OS));
        createInput.setScriptIds(List.of("sc-cross"));
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);
        when(scheduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(scriptService.getScriptsByIds(any())).thenReturn(List.of(
                ScriptResponse.builder().id("sc-cross").name("cross").supportedPlatforms(List.of(WINDOWS, MAC_OS)).build()));

        assertThat(scheduleService.create(createInput, "user-1")).isNotNull();
        verify(scheduleRepository).save(any());
    }

    @Test
    @DisplayName("create: a platform-agnostic script (no declared platforms) is allowed on any schedule")
    void create_scriptNoPlatforms_allowed() {
        createInput.setSupportedPlatforms(List.of(MAC_OS));
        createInput.setScriptIds(List.of("sc-any"));
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);
        when(scheduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(scriptService.getScriptsByIds(any())).thenReturn(List.of(
                ScriptResponse.builder().id("sc-any").name("any").supportedPlatforms(null).build()));

        assertThat(scheduleService.create(createInput, "user-1")).isNotNull();
        verify(scheduleRepository).save(any());
    }

    @Test
    @DisplayName("create: custom params referencing a scriptId not in the schedule are rejected (400)")
    void create_customParamsOrphanScriptId_rejected() {
        createInput.setScriptIds(List.of("sc-1"));
        createInput.setScriptCustomParams(List.of(customParams("sc-999")));
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> scheduleService.create(createInput, "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("sc-999");
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: two custom-params entries for the same scriptId are rejected (400)")
    void create_customParamsDuplicateScriptId_rejected() {
        createInput.setScriptIds(List.of("sc-1"));
        createInput.setScriptCustomParams(List.of(customParams("sc-1"), customParams("sc-1")));
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> scheduleService.create(createInput, "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Duplicate");
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("create RETRY_ON_RECONNECT: reconnect window == repeat is rejected (must fit inside the interval)")
    void create_retryWindowEqualsRepeat_rejected() {
        createInput.setTrigger(ScheduleScriptTrigger.DATE_TIME);
        createInput.setRepeat(86_400L);                  // daily
        createInput.setOfflineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        createInput.setReconnectWindowSeconds(86_400L);  // == repeat
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> scheduleService.create(createInput, "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("less than the schedule's repeat");
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("create RETRY_ON_RECONNECT: reconnect window < repeat is accepted (23h30m under a daily repeat)")
    void create_retryWindowUnderRepeat_accepted() {
        createInput.setTrigger(ScheduleScriptTrigger.DATE_TIME);
        createInput.setRepeat(86_400L);                  // daily
        createInput.setOfflineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        createInput.setReconnectWindowSeconds(84_600L);  // 23h30m
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);
        when(scheduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThat(scheduleService.create(createInput, "user-1")).isNotNull();
        verify(scheduleRepository).save(any());
    }

    @Test
    @DisplayName("create RETRY_ON_RECONNECT: a positive window on a one-shot (repeat=null) schedule has no upper bound")
    void create_retryOneShot_anyPositiveWindow_accepted() {
        createInput.setTrigger(ScheduleScriptTrigger.DATE_TIME);
        createInput.setRepeat(null);                     // one-shot → no next fire to overlap
        createInput.setOfflineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        createInput.setReconnectWindowSeconds(999_999L);
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);
        when(scheduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThat(scheduleService.create(createInput, "user-1")).isNotNull();
        verify(scheduleRepository).save(any());
    }

    @Test
    @DisplayName("create RETRY_ON_RECONNECT: a missing reconnect window is rejected")
    void create_retryWithoutWindow_rejected() {
        createInput.setTrigger(ScheduleScriptTrigger.DATE_TIME);
        createInput.setOfflineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        createInput.setReconnectWindowSeconds(null);
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> scheduleService.create(createInput, "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("positive reconnect window");
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("create RETRY_ON_RECONNECT on a DEVICE_ONLINE schedule is rejected (offline behaviour is DATE_TIME-only)")
    void create_retryOnDeviceOnline_rejected() {
        createInput.setTrigger(ScheduleScriptTrigger.DEVICE_ONLINE);
        createInput.setStartAt(null);                    // DEVICE_ONLINE forbids startAt/repeat
        createInput.setRepeat(null);
        createInput.setOfflineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        createInput.setReconnectWindowSeconds(3_600L);
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> scheduleService.create(createInput, "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("only valid for a DATE_TIME");
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: valid custom params (scriptId in the schedule) are persisted on the entity")
    void create_customParamsValid_persisted() {
        createInput.setScriptIds(List.of("sc-1", "sc-2"));
        ScheduledScriptCustomParamsInput cp = customParams("sc-1");
        cp.setArgs(List.of("--custom"));
        createInput.setScriptCustomParams(List.of(cp));
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);
        when(scheduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ScriptScheduleResponse result = scheduleService.create(createInput, "user-1");

        assertThat(result.getScriptCustomParams()).hasSize(1);
        assertThat(result.getScriptCustomParams().get(0).getScriptId()).isEqualTo("sc-1");
        assertThat(result.getScriptCustomParams().get(0).getArgs()).containsExactly("--custom");
    }

    private static ScheduledScriptCustomParamsInput customParams(String scriptId) {
        ScheduledScriptCustomParamsInput cp = new ScheduledScriptCustomParamsInput();
        cp.setScriptId(scriptId);
        return cp;
    }

    @Test
    @DisplayName("get: returns the mapped response when the schedule exists and is visible")
    void get_whenExists_returnsResponse() {
        ScheduleScript entity = active();
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
        Instant startFrom = Instant.parse("2026-04-01T00:00:00Z");
        Instant startTo = Instant.parse("2026-05-01T00:00:00Z");
        ScriptScheduleFilterInput filter = ScriptScheduleFilterInput.builder()
                .statuses(List.of(ScriptStatus.ACTIVE))
                .supportedPlatforms(List.of(WINDOWS))
                .authorIds(List.of("user-7"))
                .startAtFrom(startFrom)
                .startAtTo(startTo)
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
        assertThat(forwarded.getSupportedPlatforms()).containsExactly(WINDOWS);
        assertThat(forwarded.getCreatedByIds()).containsExactly("user-7");
        assertThat(forwarded.getStartAtFrom()).isEqualTo(startFrom);
        assertThat(forwarded.getStartAtTo()).isEqualTo(startTo);
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
        ScheduleScript first = active();
        first.setRepeat(604800L);
        ScheduleScript last = active();
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
        input.setStartAt(Instant.parse("2026-09-15T02:00:00Z"));   // DATE_TIME requires a startAt
        ScheduleScript existing = active();
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
        ScheduleScript existing = active();
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
        input.setStartAt(Instant.parse("2026-09-15T02:00:00Z"));   // DATE_TIME requires a startAt
        ScheduleScript existing = active();
        existing.setName("Same");
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(existing));
        when(scheduleRepository.save(existing)).thenReturn(existing);

        scheduleService.update(input);

        verify(scheduleRepository, never()).existsByTenantIdAndNameAndIdNotAndStatusIn(any(), any(), any(), any());
    }

    @Test
    @DisplayName("delete: soft-deletes (status DELETED + statusChangedAt) via save, not hard-delete")
    void delete_softDeletes() {
        ScheduleScript active = active();
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
        ScheduleScript active = active();
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(active));
        when(scheduleRepository.save(active)).thenReturn(active);

        scheduleService.archive(SCHEDULE_ID);

        assertThat(active.getStatus()).isEqualTo(ScriptStatus.ARCHIVED);
        assertThat(active.getStatusChangedAt()).isNotNull();
        verify(scheduleRepository).save(active);
    }

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
    @DisplayName("create: repeat of 0 or a negative multiple is rejected — both satisfy `% slot == 0` but mean no/backwards cadence")
    void create_repeatZeroOrNegative_rejected() {
        createInput.setStartAt(Instant.parse("2026-09-15T02:00:00Z"));
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);

        for (long repeat : List.of(0L, -1800L)) {
            createInput.setRepeat(repeat);
            assertThatThrownBy(() -> scheduleService.create(createInput, "user-1"))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("positive");
        }
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

    @Test
    @DisplayName("create: a null trigger defaults to DATE_TIME")
    void create_nullTrigger_defaultsToDateTime() {
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);
        when(scheduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThat(scheduleService.create(createInput, "user-1").getTrigger()).isEqualTo(ScheduleScriptTrigger.DATE_TIME);
    }

    @Test
    @DisplayName("create: DEVICE_ONLINE with no timing → saved with the trigger and a null nextRunAt (never on the timer grid)")
    void create_deviceOnline_noTiming() {
        createInput.setTrigger(ScheduleScriptTrigger.DEVICE_ONLINE);
        createInput.setStartAt(null);   // event-triggered: no timing
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);
        when(scheduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ScriptScheduleResponse result = scheduleService.create(createInput, "user-1");

        assertThat(result.getTrigger()).isEqualTo(ScheduleScriptTrigger.DEVICE_ONLINE);
        ArgumentCaptor<ScheduleScript> saved = ArgumentCaptor.forClass(ScheduleScript.class);
        verify(scheduleRepository).save(saved.capture());
        assertThat(saved.getValue().getTrigger()).isEqualTo(ScheduleScriptTrigger.DEVICE_ONLINE);
        assertThat(saved.getValue().getNextRunAt()).isNull();
    }

    @Test
    @DisplayName("create: DEVICE_ONLINE that also sets startAt is rejected — event-triggered schedules carry no timing")
    void create_deviceOnline_withStartAt_rejected() {
        createInput.setTrigger(ScheduleScriptTrigger.DEVICE_ONLINE);
        createInput.setStartAt(Instant.parse("2026-09-15T02:00:00Z"));
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> scheduleService.create(createInput, "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("DEVICE_ONLINE");
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: DEVICE_ONLINE that also sets repeat is rejected")
    void create_deviceOnline_withRepeat_rejected() {
        createInput.setTrigger(ScheduleScriptTrigger.DEVICE_ONLINE);
        createInput.setStartAt(null);
        createInput.setRepeat(1800L);
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> scheduleService.create(createInput, "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("DEVICE_ONLINE");
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: DATE_TIME (\"Run on schedule\") with no startAt is rejected — a start date & time is mandatory")
    void create_dateTime_missingStartAt_rejected() {
        createInput.setTrigger(ScheduleScriptTrigger.DATE_TIME);
        createInput.setStartAt(null);
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> scheduleService.create(createInput, "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("startAt");
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: a null trigger (defaults to DATE_TIME) with no startAt is also rejected")
    void create_defaultTrigger_missingStartAt_rejected() {
        createInput.setStartAt(null);   // trigger left null → defaults to DATE_TIME
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> scheduleService.create(createInput, "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("startAt");
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("update: switching/keeping a DATE_TIME schedule with no startAt is rejected")
    void update_dateTime_missingStartAt_rejected() {
        UpdateScriptScheduleInput input = new UpdateScriptScheduleInput();
        input.setId(SCHEDULE_ID);
        input.setName("Nightly Maintenance");
        input.setTrigger(ScheduleScriptTrigger.DATE_TIME);   // no startAt
        ScheduleScript existing = active();
        existing.setName("Nightly Maintenance");
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> scheduleService.update(input))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("startAt");
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("update: switching a DATE_TIME schedule to DEVICE_ONLINE clears nextRunAt and stores the trigger")
    void update_toDeviceOnline_clearsNextRun() {
        ScheduleScript existing = active();
        existing.setName("Nightly Maintenance");
        existing.setTrigger(ScheduleScriptTrigger.DATE_TIME);
        existing.setStartAt(Instant.parse("2026-09-15T02:00:00Z"));
        existing.setNextRunAt(Instant.parse("2026-09-15T02:00:00Z"));
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(existing));
        when(scheduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        UpdateScriptScheduleInput input = new UpdateScriptScheduleInput();
        input.setId(SCHEDULE_ID);
        input.setName("Nightly Maintenance");
        input.setTrigger(ScheduleScriptTrigger.DEVICE_ONLINE);   // no startAt/repeat

        ScriptScheduleResponse result = scheduleService.update(input);

        assertThat(result.getTrigger()).isEqualTo(ScheduleScriptTrigger.DEVICE_ONLINE);
        assertThat(existing.getTrigger()).isEqualTo(ScheduleScriptTrigger.DEVICE_ONLINE);
        assertThat(existing.getNextRunAt()).isNull();
    }



    private static ScheduleScript deleted() {
        ScheduleScript s = new ScheduleScript();
        s.setId(SCHEDULE_ID);
        s.setStatus(ScriptStatus.DELETED);
        return s;
    }
}
