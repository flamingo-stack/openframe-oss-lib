package com.openframe.api.service.rmm;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.script.CreateScriptInput;
import com.openframe.api.dto.script.ScriptEnvVarInput;
import com.openframe.api.dto.script.ScriptFilterInput;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.script.UpdateScriptInput;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.ScriptMapper;
import com.openframe.api.service.ScriptTagService;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.document.rmm.filter.ScriptQueryFilter;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SCRIPT_ID = "65f4a8000000000000000001";

    @Mock
    private ScriptRepository scriptRepository;

    @Mock
    private ScriptMapper scriptMapper;

    @Mock
    private TenantIdProvider tenantIdProvider;

    @Mock
    private ScriptTagService scriptTagService;

    @InjectMocks
    private ScriptService scriptService;

    private CreateScriptInput createInput;
    private UpdateScriptInput updateInput;

    @BeforeEach
    void setUp() {
        createInput = new CreateScriptInput();
        createInput.setName("Restart Spooler");
        createInput.setShell(ScriptShell.POWERSHELL);
        createInput.setScriptBody("Restart-Service -Name spooler");

        updateInput = new UpdateScriptInput();
        updateInput.setId(SCRIPT_ID); // id now travels inside the input

        // lenient: the empty-input getScriptsByIds path short-circuits before resolving the tenant.
        lenient().when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
    }

    private void stubSortAllowlistDefault() {
        when(scriptRepository.getDefaultSortField()).thenReturn("_id");
    }

    @Test
    @DisplayName("create: persists the entity and returns the mapped response when the name is unique within the tenant")
    void create_whenNameUnique_persistsAndReturnsResponse() {
        Script mapped = new Script();
        mapped.setName(createInput.getName());
        Script saved = new Script();
        saved.setId(SCRIPT_ID);
        saved.setName(createInput.getName());
        ScriptResponse response = ScriptResponse.builder().id(SCRIPT_ID).name(createInput.getName()).build();

        when(scriptRepository.existsByTenantIdAndName(TENANT_ID, createInput.getName())).thenReturn(false);
        when(scriptMapper.toEntity(TENANT_ID, createInput)).thenReturn(mapped);
        when(scriptRepository.save(mapped)).thenReturn(saved);
        when(scriptMapper.toResponse(saved)).thenReturn(response);

        createInput.setTagIds(List.of("tag-1", "tag-2"));

        ScriptResponse result = scriptService.create(createInput, "user-1");

        assertThat(result).isSameAs(response);
        verify(scriptRepository).save(mapped);
        // createdBy is stamped from the authenticated caller before save.
        assertThat(mapped.getCreatedBy()).isEqualTo("user-1");
        // Tag assignments are (re)written from the input after the script is saved.
        verify(scriptTagService).replaceTags(SCRIPT_ID, List.of("tag-1", "tag-2"));
    }

    @Test
    @DisplayName("create: throws ConflictException when a script with the same name already exists in the tenant")
    void create_whenNameAlreadyExists_throwsConflict() {
        when(scriptRepository.existsByTenantIdAndName(TENANT_ID, createInput.getName())).thenReturn(true);

        assertThatThrownBy(() -> scriptService.create(createInput, "user-1"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining(createInput.getName());

        verify(scriptRepository, never()).save(any());
        verifyNoInteractions(scriptMapper);
    }

    @Test
    @DisplayName("create: env vars (including secret ones) are persisted as supplied — secrets are stored in plaintext until the secret-management story lands")
    void create_whenInputHasEnvVars_persistsThemThroughTheMapper() {
        createInput.setEnvVars(List.of(
                ScriptEnvVarInput.builder().name("LOG_LEVEL").value("INFO").secret(false).build(),
                ScriptEnvVarInput.builder().name("API_TOKEN").value("xyz").secret(true).build()
        ));
        Script mapped = new Script();
        Script saved = new Script();
        saved.setId(SCRIPT_ID);
        when(scriptRepository.existsByTenantIdAndName(TENANT_ID, createInput.getName())).thenReturn(false);
        when(scriptMapper.toEntity(TENANT_ID, createInput)).thenReturn(mapped);
        when(scriptRepository.save(mapped)).thenReturn(saved);
        when(scriptMapper.toResponse(saved)).thenReturn(ScriptResponse.builder().id(SCRIPT_ID).build());

        ScriptResponse result = scriptService.create(createInput, "user-1");

        assertThat(result.getId()).isEqualTo(SCRIPT_ID);
    }

    @Test
    @DisplayName("get: returns the mapped response when the script exists in the tenant")
    void get_whenExists_returnsResponse() {
        Script entity = new Script();
        entity.setId(SCRIPT_ID);
        ScriptResponse response = ScriptResponse.builder().id(SCRIPT_ID).build();
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(entity));
        when(scriptMapper.toResponse(entity)).thenReturn(response);

        ScriptResponse result = scriptService.get(SCRIPT_ID);

        assertThat(result).isSameAs(response);
    }

    @Test
    @DisplayName("get: throws NotFoundException when the script does not exist in the tenant")
    void get_whenNotFound_throwsNotFound() {
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> scriptService.get(SCRIPT_ID))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining(SCRIPT_ID);

        verifyNoInteractions(scriptMapper);
    }

    @Test
    @DisplayName("findById: returns a present, non-deleted script mapped to a response (non-throwing, for node refetch)")
    void findById_whenVisible_returnsResponse() {
        Script entity = new Script();
        entity.setId(SCRIPT_ID);
        entity.setStatus(ScriptStatus.ACTIVE);
        ScriptResponse response = ScriptResponse.builder().id(SCRIPT_ID).build();
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(entity));
        when(scriptMapper.toResponse(entity)).thenReturn(response);

        assertThat(scriptService.findById(SCRIPT_ID)).contains(response);
    }

    @Test
    @DisplayName("findById: empty for a soft-deleted script (does NOT throw, unlike get)")
    void findById_whenDeleted_returnsEmpty() {
        Script entity = new Script();
        entity.setStatus(ScriptStatus.DELETED);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(entity));

        assertThat(scriptService.findById(SCRIPT_ID)).isEmpty();
        verifyNoInteractions(scriptMapper);
    }

    @Test
    @DisplayName("findById: empty when the script does not exist in the tenant")
    void findById_whenMissing_returnsEmpty() {
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.empty());

        assertThat(scriptService.findById(SCRIPT_ID)).isEmpty();
        verifyNoInteractions(scriptMapper);
    }

    @Test
    @DisplayName("getScriptsByIds: batch-resolves scripts in the tenant and maps each — INCLUDING soft-deleted ones (History must keep resolving a deleted script's name)")
    void getScriptsByIds_includesSoftDeletedAndMaps() {
        Script active = new Script();
        active.setId("s-1");
        active.setStatus(ScriptStatus.ACTIVE);
        Script deleted = new Script();
        deleted.setId("s-2");
        deleted.setStatus(ScriptStatus.DELETED);
        ScriptResponse r1 = ScriptResponse.builder().id("s-1").name("alpha").build();
        ScriptResponse r2 = ScriptResponse.builder().id("s-2").name("beta").build();
        when(scriptRepository.findByTenantIdAndIdIn(TENANT_ID, List.of("s-1", "s-2")))
                .thenReturn(List.of(active, deleted));
        when(scriptMapper.toResponse(active)).thenReturn(r1);
        when(scriptMapper.toResponse(deleted)).thenReturn(r2);

        assertThat(scriptService.getScriptsByIds(List.of("s-1", "s-2")))
                .containsExactly(r1, r2);
    }

    @Test
    @DisplayName("getScriptsByIds: empty / null input short-circuits to an empty list — no repository or tenant lookup")
    void getScriptsByIds_emptyInput_returnsEmptyWithoutLookup() {
        assertThat(scriptService.getScriptsByIds(List.of())).isEmpty();
        assertThat(scriptService.getScriptsByIds(null)).isEmpty();
        verifyNoInteractions(scriptRepository);
        verifyNoInteractions(scriptMapper);
    }

    @Test
    @DisplayName("list: forward pagination — fetches limit+1 rows, drops the extra, marks hasNextPage=true and hasPreviousPage=false on the first page")
    void list_forwardFirstPage_dropsSentinelAndReportsHasNext() {
        stubSortAllowlistDefault();
        Script s1 = new Script();
        s1.setId("id-1");
        Script s2 = new Script();
        s2.setId("id-2");
        Script s3 = new Script();
        s3.setId("id-3");
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(2).cursor(null).backward(false).build();

        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq(null), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq(null), eq(false), eq(3)))
                .thenReturn(List.of(s1, s2, s3));
        when(scriptMapper.toResponse(s1)).thenReturn(ScriptResponse.builder().id("id-1").build());
        when(scriptMapper.toResponse(s2)).thenReturn(ScriptResponse.builder().id("id-2").build());

        GenericQueryResult<ScriptResponse> result = scriptService.list(null, null, null, criteria);

        assertThat(result.getItems()).extracting(ScriptResponse::getId).containsExactly("id-1", "id-2");
        assertThat(result.getPageInfo().isHasNextPage()).isTrue();
        assertThat(result.getPageInfo().isHasPreviousPage()).isFalse();
        assertThat(result.getPageInfo().getStartCursor()).isNotBlank();
        assertThat(result.getPageInfo().getEndCursor()).isNotBlank();
        verify(scriptMapper, never()).toResponse(s3);
    }

    @Test
    @DisplayName("list: forward pagination — last page (no sentinel returned) → hasNextPage=false, hasPreviousPage reflects the supplied cursor")
    void list_forwardLastPage_hasNoNext() {
        stubSortAllowlistDefault();
        Script s1 = new Script();
        s1.setId("id-1");
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(10).cursor("decoded-cursor").backward(false).build();

        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq(null), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq("decoded-cursor"), eq(false), eq(11)))
                .thenReturn(List.of(s1));
        when(scriptMapper.toResponse(s1)).thenReturn(ScriptResponse.builder().id("id-1").build());

        GenericQueryResult<ScriptResponse> result = scriptService.list(null, null, null, criteria);

        assertThat(result.getItems()).hasSize(1);
        assertThat(result.getPageInfo().isHasNextPage()).isFalse();
        assertThat(result.getPageInfo().isHasPreviousPage()).isTrue();
    }

    @Test
    @DisplayName("list: backward pagination — items are reversed so the page is still displayed newest-first, and hasMore maps to hasPreviousPage")
    void list_backwardPagination_reversesItemsAndFlipsHasMore() {
        stubSortAllowlistDefault();
        Script s1 = new Script();
        s1.setId("id-1");
        Script s2 = new Script();
        s2.setId("id-2");
        Script s3 = new Script();
        s3.setId("id-3");
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(2).cursor("decoded-cursor").backward(true).build();

        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq(null), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq("decoded-cursor"), eq(true), eq(3)))
                .thenReturn(List.of(s1, s2, s3));
        when(scriptMapper.toResponse(any(Script.class)))
                .thenAnswer(inv -> ScriptResponse.builder().id(((Script) inv.getArgument(0)).getId()).build());

        GenericQueryResult<ScriptResponse> result = scriptService.list(null, null, null, criteria);

        // After sentinel-drop + reverse: page should be newest-first [id-2, id-1]
        assertThat(result.getItems()).extracting(ScriptResponse::getId).containsExactly("id-2", "id-1");
        assertThat(result.getPageInfo().isHasPreviousPage()).isTrue();
        assertThat(result.getPageInfo().isHasNextPage()).isTrue();   // we paged with a cursor → there's a next
    }

    @Test
    @DisplayName("list: empty result — both cursors null, hasNextPage/hasPreviousPage reflect lack of data")
    void list_emptyResult_returnsEmptyPageInfo() {
        stubSortAllowlistDefault();
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(20).cursor(null).backward(false).build();
        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq(null), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq(null), eq(false), eq(21)))
                .thenReturn(List.of());

        GenericQueryResult<ScriptResponse> result = scriptService.list(null, null, null, criteria);

        assertThat(result.getItems()).isEmpty();
        assertThat(result.getPageInfo().getStartCursor()).isNull();
        assertThat(result.getPageInfo().getEndCursor()).isNull();
        assertThat(result.getPageInfo().isHasNextPage()).isFalse();
        assertThat(result.getPageInfo().isHasPreviousPage()).isFalse();
    }

    @Test
    @DisplayName("list: page size is normalised — pagination.normalize() is applied before fetching (default size if not supplied)")
    void list_normalisesPaginationCriteria() {
        stubSortAllowlistDefault();
        CursorPaginationCriteria raw = CursorPaginationCriteria.builder()
                .limit(null).cursor(null).backward(false).build();
        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq(null), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq(null), eq(false),
                eq(CursorPaginationCriteria.DEFAULT_PAGE_SIZE + 1))).thenReturn(List.of());

        scriptService.list(null, null, null, raw);

        verify(scriptRepository).findPageForTenant(eq(TENANT_ID), eq(null), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq(null), eq(false),
                eq(CursorPaginationCriteria.DEFAULT_PAGE_SIZE + 1));
    }

    @Test
    @DisplayName("list: filter + search + sort are forwarded to the repository; the API-layer filter is translated into a data-layer ScriptQueryFilter")
    void list_filterSearchSort_forwardedToRepository() {
        // No default-sort stub: a valid sort field bypasses getDefaultSortField().
        when(scriptRepository.isSortableField("name")).thenReturn(true);

        // The API-layer tagIds/authorIds filters are forwarded to the data-layer filter
        // (the repository resolves tagIds → script ids; authorIds map to createdBy).
        ScriptFilterInput filter = ScriptFilterInput.builder()
                .tagIds(List.of("tag-1")).authorIds(List.of("user-7")).build();
        SortInput sort = SortInput.builder().field("name").direction(SortDirection.ASC).build();
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(20).cursor(null).backward(false).build();

        when(scriptRepository.findPageForTenant(eq(TENANT_ID), any(ScriptQueryFilter.class), eq("backup"),
                eq("name"), eq(Sort.Direction.ASC), eq(null), eq(false), eq(21)))
                .thenReturn(List.of());

        scriptService.list(filter, "backup", sort, criteria);

        org.mockito.ArgumentCaptor<ScriptQueryFilter> filterCaptor =
                org.mockito.ArgumentCaptor.forClass(ScriptQueryFilter.class);
        verify(scriptRepository).findPageForTenant(eq(TENANT_ID), filterCaptor.capture(), eq("backup"),
                eq("name"), eq(Sort.Direction.ASC), eq(null), eq(false), eq(21));
        assertThat(filterCaptor.getValue().getTagIds()).containsExactly("tag-1");
        assertThat(filterCaptor.getValue().getCreatedByIds()).containsExactly("user-7");

        // filteredCount must reflect the SAME filter + search (not a tenant-wide count)
        verify(scriptRepository).countForTenant(eq(TENANT_ID), any(ScriptQueryFilter.class), eq("backup"));
    }

    @Test
    @DisplayName("list: exposes filteredCount — the full tenant+filter+search total (independent of the page) so the UI shows the count up front")
    void list_exposesFilteredCount() {
        stubSortAllowlistDefault();
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(20).cursor(null).backward(false).build();

        when(scriptRepository.countForTenant(TENANT_ID, null, null)).thenReturn(146L);
        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq(null), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq(null), eq(false), eq(21)))
                .thenReturn(List.of());

        CountedGenericQueryResult<ScriptResponse> result = scriptService.list(null, null, null, criteria);

        // Total is the tenant-wide matching count, independent of the (empty) page.
        assertThat(result.getFilteredCount()).isEqualTo(146);
        assertThat(result.getItems()).isEmpty();
    }

    @Test
    @DisplayName("list: invalid sort field falls back to the repository default (no exception)")
    void list_invalidSortField_fallsBackToDefault() {
        stubSortAllowlistDefault();
        when(scriptRepository.isSortableField("malicious; drop_database")).thenReturn(false);

        SortInput sort = SortInput.builder().field("malicious; drop_database").direction(SortDirection.DESC).build();
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(10).cursor(null).backward(false).build();

        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq(null), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq(null), eq(false), eq(11)))
                .thenReturn(List.of());

        scriptService.list(null, null, sort, criteria);

        verify(scriptRepository).findPageForTenant(eq(TENANT_ID), eq(null), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq(null), eq(false), eq(11));
    }

    @Test
    @DisplayName("update: PUT semantics — delegates the full overwrite (including nulls) to the mapper and saves the resulting entity")
    void update_whenScriptExists_delegatesOverwriteAndSaves() {
        Script existing = new Script();
        existing.setId(SCRIPT_ID);
        existing.setName("old");
        Script saved = new Script();
        saved.setId(SCRIPT_ID);
        ScriptResponse response = ScriptResponse.builder().id(SCRIPT_ID).build();

        updateInput.setName("old"); // unchanged name — skip uniqueness check
        updateInput.setDescription("new description");
        updateInput.setTagIds(List.of("tag-9"));

        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(existing));
        when(scriptRepository.save(existing)).thenReturn(saved);
        when(scriptMapper.toResponse(saved)).thenReturn(response);

        ScriptResponse result = scriptService.update(updateInput);

        assertThat(result).isSameAs(response);
        verify(scriptMapper).updateEntity(existing, updateInput);
        verify(scriptRepository).save(existing);
        // PUT semantics: the tag set is replaced from the input.
        verify(scriptTagService).replaceTags(SCRIPT_ID, List.of("tag-9"));
    }

    @Test
    @DisplayName("update: throws NotFoundException when the script does not exist in the tenant")
    void update_whenNotFound_throwsNotFound() {
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> scriptService.update(updateInput))
                .isInstanceOf(NotFoundException.class);

        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("update: throws ConflictException when the new name collides with another script in the tenant")
    void update_renamingToExistingName_throwsConflict() {
        Script existing = new Script();
        existing.setId(SCRIPT_ID);
        existing.setName("old name");
        updateInput.setName("taken name");

        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(existing));
        when(scriptRepository.existsByTenantIdAndNameAndIdNot(TENANT_ID, "taken name", SCRIPT_ID)).thenReturn(true);

        assertThatThrownBy(() -> scriptService.update(updateInput))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("taken name");

        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("update: when the new name equals the existing name (null-safe), the uniqueness check is skipped — no extra repository round-trip")
    void update_keepingSameName_skipsUniquenessCheck() {
        Script existing = new Script();
        existing.setId(SCRIPT_ID);
        existing.setName("same name");
        updateInput.setName("same name");

        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(existing));
        when(scriptRepository.save(existing)).thenReturn(existing);
        when(scriptMapper.toResponse(existing)).thenReturn(ScriptResponse.builder().id(SCRIPT_ID).build());

        scriptService.update(updateInput);

        verify(scriptRepository, never()).existsByTenantIdAndNameAndIdNot(any(), any(), any());
    }

    @Test
    @DisplayName("update: PUT semantics — when only an optional field (description) changes, name uniqueness is not re-checked")
    void update_renamingUnchangedOptionalFieldOnly_skipsUniquenessCheck() {
        Script existing = new Script();
        existing.setId(SCRIPT_ID);
        existing.setName("stable name");

        updateInput.setName("stable name");                 // name unchanged
        updateInput.setShell(ScriptShell.POWERSHELL);
        updateInput.setScriptBody("Restart-Service spooler");
        updateInput.setDescription("brand new description"); // only this changes

        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(existing));
        when(scriptRepository.save(existing)).thenReturn(existing);
        when(scriptMapper.toResponse(existing)).thenReturn(ScriptResponse.builder().id(SCRIPT_ID).build());

        scriptService.update(updateInput);

        verify(scriptRepository, never()).existsByTenantIdAndNameAndIdNot(any(), any(), any());
        verify(scriptMapper).updateEntity(existing, updateInput);
    }

    @Test
    @DisplayName("get: throws NotFoundException when the script exists but has been soft-deleted (treated as not-found from the API surface)")
    void get_whenScriptIsDeleted_throwsNotFound() {
        Script deleted = new Script();
        deleted.setId(SCRIPT_ID);
        deleted.setStatus(ScriptStatus.DELETED);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(deleted));

        assertThatThrownBy(() -> scriptService.get(SCRIPT_ID))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining(SCRIPT_ID);

        verifyNoInteractions(scriptMapper);
    }

    @Test
    @DisplayName("update: throws NotFoundException when the script exists but has been soft-deleted (cannot edit a deleted script)")
    void update_whenScriptIsDeleted_throwsNotFound() {
        Script deleted = new Script();
        deleted.setId(SCRIPT_ID);
        deleted.setStatus(ScriptStatus.DELETED);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(deleted));

        assertThatThrownBy(() -> scriptService.update(updateInput))
                .isInstanceOf(NotFoundException.class);

        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("delete: marks the script DELETED, stamps statusChangedAt, and persists via save() — does not hard-delete")
    void delete_whenScriptIsActive_softDeletesAndSaves() {
        Script active = new Script();
        active.setId(SCRIPT_ID);
        active.setStatus(ScriptStatus.ACTIVE);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(active));
        when(scriptRepository.save(active)).thenReturn(active);

        String deletedId = scriptService.delete(SCRIPT_ID);

        assertThat(deletedId).isEqualTo(SCRIPT_ID);
        assertThat(active.getStatus()).isEqualTo(ScriptStatus.DELETED);
        assertThat(active.getStatusChangedAt()).isNotNull();
        verify(scriptRepository).save(active);
        verify(scriptRepository, never()).deleteByTenantIdAndId(any(), any());
    }

    @Test
    @DisplayName("delete: when the script does not exist in the tenant, throws NotFoundException")
    void delete_whenScriptNotFound_throwsNotFound() {
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> scriptService.delete(SCRIPT_ID))
                .isInstanceOf(NotFoundException.class);

        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("delete: when the script is already soft-deleted, the call is an idempotent no-op (statusChangedAt is NOT re-stamped)")
    void delete_whenAlreadyDeleted_isNoOp() {
        Script alreadyDeleted = new Script();
        alreadyDeleted.setId(SCRIPT_ID);
        alreadyDeleted.setStatus(ScriptStatus.DELETED);
        Instant originalDeletedAt = Instant.parse("2020-01-01T00:00:00Z");
        alreadyDeleted.setStatusChangedAt(originalDeletedAt);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(alreadyDeleted));

        String deletedId = scriptService.delete(SCRIPT_ID);

        assertThat(deletedId).isEqualTo(SCRIPT_ID);
        assertThat(alreadyDeleted.getStatusChangedAt()).isEqualTo(originalDeletedAt);
        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("archive: marks an ACTIVE script ARCHIVED, stamps statusChangedAt, persists via save(), returns the updated script")
    void archive_whenScriptIsActive_setsArchivedAndSaves() {
        Script active = new Script();
        active.setId(SCRIPT_ID);
        active.setStatus(ScriptStatus.ACTIVE);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(active));
        when(scriptRepository.save(active)).thenReturn(active);
        when(scriptMapper.toResponse(active)).thenReturn(ScriptResponse.builder().id(SCRIPT_ID).build());

        ScriptResponse result = scriptService.archive(SCRIPT_ID);

        assertThat(result.getId()).isEqualTo(SCRIPT_ID);
        assertThat(active.getStatus()).isEqualTo(ScriptStatus.ARCHIVED);
        assertThat(active.getStatusChangedAt()).isNotNull();
        verify(scriptRepository).save(active);
    }

    @Test
    @DisplayName("archive: when already ARCHIVED it's an idempotent no-op (statusChangedAt NOT re-stamped, no save) and the script is returned")
    void archive_whenAlreadyArchived_isNoOp() {
        Script archived = new Script();
        archived.setId(SCRIPT_ID);
        archived.setStatus(ScriptStatus.ARCHIVED);
        Instant original = Instant.parse("2020-01-01T00:00:00Z");
        archived.setStatusChangedAt(original);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(archived));
        when(scriptMapper.toResponse(archived)).thenReturn(ScriptResponse.builder().id(SCRIPT_ID).build());

        ScriptResponse result = scriptService.archive(SCRIPT_ID);

        assertThat(result.getId()).isEqualTo(SCRIPT_ID);
        assertThat(archived.getStatusChangedAt()).isEqualTo(original);
        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("archive: throws NotFoundException for a soft-deleted script (cannot archive a deleted script)")
    void archive_whenScriptIsDeleted_throwsNotFound() {
        Script deleted = new Script();
        deleted.setId(SCRIPT_ID);
        deleted.setStatus(ScriptStatus.DELETED);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(deleted));

        assertThatThrownBy(() -> scriptService.archive(SCRIPT_ID))
                .isInstanceOf(NotFoundException.class);

        verify(scriptRepository, never()).save(any());
        verifyNoInteractions(scriptMapper);
    }

    @Test
    @DisplayName("unarchive: restores an ARCHIVED script to ACTIVE, stamps statusChangedAt, persists, returns the updated script")
    void unarchive_whenScriptIsArchived_setsActiveAndSaves() {
        Script archived = new Script();
        archived.setId(SCRIPT_ID);
        archived.setStatus(ScriptStatus.ARCHIVED);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(archived));
        when(scriptRepository.save(archived)).thenReturn(archived);
        when(scriptMapper.toResponse(archived)).thenReturn(ScriptResponse.builder().id(SCRIPT_ID).build());

        ScriptResponse result = scriptService.unarchive(SCRIPT_ID);

        assertThat(result.getId()).isEqualTo(SCRIPT_ID);
        assertThat(archived.getStatus()).isEqualTo(ScriptStatus.ACTIVE);
        assertThat(archived.getStatusChangedAt()).isNotNull();
        verify(scriptRepository).save(archived);
    }

    @Test
    @DisplayName("unarchive: when the script is not archived (e.g. ACTIVE) it's an idempotent no-op (no save) and the script is returned")
    void unarchive_whenNotArchived_isNoOp() {
        Script active = new Script();
        active.setId(SCRIPT_ID);
        active.setStatus(ScriptStatus.ACTIVE);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(active));
        when(scriptMapper.toResponse(active)).thenReturn(ScriptResponse.builder().id(SCRIPT_ID).build());

        ScriptResponse result = scriptService.unarchive(SCRIPT_ID);

        assertThat(result.getId()).isEqualTo(SCRIPT_ID);
        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("unarchive: throws NotFoundException for a soft-deleted script")
    void unarchive_whenScriptIsDeleted_throwsNotFound() {
        Script deleted = new Script();
        deleted.setId(SCRIPT_ID);
        deleted.setStatus(ScriptStatus.DELETED);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(deleted));

        assertThatThrownBy(() -> scriptService.unarchive(SCRIPT_ID))
                .isInstanceOf(NotFoundException.class);

        verify(scriptRepository, never()).save(any());
        verifyNoInteractions(scriptMapper);
    }
}
