package com.openframe.api.service.rmm;

import com.openframe.api.service.rmm.schedule.ScheduleDeliveryRefresher;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.script.CreateScriptInput;
import com.openframe.api.dto.rmm.script.ScriptEnvVarInput;
import com.openframe.api.dto.rmm.script.ScriptFilterInput;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.rmm.script.UpdateScriptInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.ScriptMapper;
import com.openframe.api.service.rmm.script.ScriptPrivilegeValidator;
import com.openframe.api.service.rmm.script.ScriptTagService;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.api.service.rmm.script.ScriptTimeoutValidator;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptCreationSource;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.filter.ScriptQueryFilter;
import com.openframe.data.repository.cursor.CursorBase64;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.data.repository.rmm.CustomScriptRepository;
import com.openframe.data.repository.rmm.CustomScriptRepositoryImpl;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SCRIPT_ID = "65f4a8000000000000000001";
    private static final String ROW_1 = "65f4a8000000000000000010";
    private static final String ROW_2 = "65f4a8000000000000000020";
    private static final String ROW_3 = "65f4a8000000000000000030";
    private static final String ROW_4 = "65f4a8000000000000000040";
    private static final String ROW_5 = "65f4a8000000000000000050";
    private static final String GONE_ROW = "65f4a8000000000000000035";
    private static final String ID = "_id";
    private static final String NAME = "name";
    private static final String CREATED_AT = "createdAt";
    private static final String UPDATED_AT = "updatedAt";
    private static final String KEYSET_PREFIX = "k1|";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final Instant EARLY = Instant.ofEpochMilli(1_700_000_000_000L);
    private static final Instant MIDDLE = EARLY.plusSeconds(60);
    private static final Instant LATE = EARLY.plusSeconds(120);
    private static final CursorPosition NO_POSITION = new CursorPosition.None();
    /**
     * Mirror of the ScriptService constant — DELETED is intentionally OUT so
     * the mock asserts we ONLY collide against visible (ACTIVE/ARCHIVED) rows.
     */
    private static final List<ScriptStatus> UNIQUE_STATUSES =
            List.of(ScriptStatus.ACTIVE, ScriptStatus.ARCHIVED);

    @Mock
    private ScriptRepository scriptRepository;

    @Mock
    private ScriptMapper scriptMapper;

    @Mock
    private TenantIdProvider tenantIdProvider;

    @Mock
    private ScriptTagService scriptTagService;
    @Mock
    private ScriptTimeoutValidator timeoutValidator;
    @Mock
    private ScriptPrivilegeValidator privilegeValidator;
    @Mock
    private ScheduleDeliveryRefresher deliveryRefresher;

    @InjectMocks
    private ScriptService scriptService;

    private final CustomScriptRepository cursorIssuer = new CustomScriptRepositoryImpl(mock(MongoTemplate.class));

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

        when(scriptRepository.existsByTenantIdAndNameAndStatusIn(TENANT_ID, createInput.getName(), UNIQUE_STATUSES)).thenReturn(false);
        when(scriptMapper.toEntity(TENANT_ID, createInput)).thenReturn(mapped);
        when(scriptRepository.save(mapped)).thenReturn(saved);
        when(scriptMapper.toResponse(saved)).thenReturn(response);

        createInput.setTagIds(List.of("tag-1", "tag-2"));

        ScriptResponse result = scriptService.create(createInput, "user-1", ScriptCreationSource.MANUAL);

        assertThat(result).isSameAs(response);
        verify(scriptRepository).save(mapped);
        // createdBy is stamped from the authenticated caller before save.
        assertThat(mapped.getCreatedBy()).isEqualTo("user-1");
        assertThat(mapped.getCreationSource()).isEqualTo(ScriptCreationSource.MANUAL);
        // Tag assignments are (re)written from the input after the script is saved.
        verify(scriptTagService).replaceTags(SCRIPT_ID, List.of("tag-1", "tag-2"));
    }

    @Test
    @DisplayName("create: validates the timeout first — a rejected timeout throws (400) and nothing is persisted")
    void create_validatesTimeoutBeforeSave() {
        createInput.setDefaultTimeoutSeconds(700);
        doThrow(new BadRequestException(ErrorCode.VALIDATION_ERROR, "timeoutSeconds must not exceed 600 seconds"))
                .when(timeoutValidator).validate(700);

        assertThatThrownBy(() -> scriptService.create(createInput, "user-1", ScriptCreationSource.MANUAL))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("600");

        verify(timeoutValidator).validate(700);
        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("update: validates the timeout first — a rejected timeout throws before the script is even loaded")
    void update_validatesTimeoutBeforeSave() {
        updateInput.setName("Restart Spooler");
        updateInput.setDefaultTimeoutSeconds(700);
        doThrow(new BadRequestException(ErrorCode.VALIDATION_ERROR, "timeoutSeconds must not exceed 600 seconds"))
                .when(timeoutValidator).validate(700);

        assertThatThrownBy(() -> scriptService.update(updateInput))
                .isInstanceOf(BadRequestException.class);

        verify(timeoutValidator).validate(700);
        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: a privilege level the declared platforms cannot run throws (400) and nothing is persisted")
    void create_validatesPrivilegeBeforeSave() {
        // setup
        createInput.setPrivilegeLevel(PrivilegeLevel.ELEVATED_USER);
        createInput.setSupportedPlatforms(List.of(OsType.MAC_OS));
        doThrow(new BadRequestException(ErrorCode.VALIDATION_ERROR, "ELEVATED_USER is supported only on Windows"))
                .when(privilegeValidator).validate(PrivilegeLevel.ELEVATED_USER, List.of(OsType.MAC_OS));

        // execution + verifications
        assertThatThrownBy(() -> scriptService.create(createInput, "user-1", ScriptCreationSource.MANUAL))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Windows");
        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("update: a privilege level the declared platforms cannot run throws before the script is even loaded")
    void update_validatesPrivilegeBeforeSave() {
        // setup
        updateInput.setName("Restart Spooler");
        updateInput.setPrivilegeLevel(PrivilegeLevel.ELEVATED_USER);
        updateInput.setSupportedPlatforms(List.of(OsType.MAC_OS));
        doThrow(new BadRequestException(ErrorCode.VALIDATION_ERROR, "ELEVATED_USER is supported only on Windows"))
                .when(privilegeValidator).validate(PrivilegeLevel.ELEVATED_USER, List.of(OsType.MAC_OS));

        // execution + verifications
        assertThatThrownBy(() -> scriptService.update(updateInput))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Windows");
        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: throws ConflictException when a script with the same name already exists in the tenant")
    void create_whenNameAlreadyExists_throwsConflict() {
        when(scriptRepository.existsByTenantIdAndNameAndStatusIn(TENANT_ID, createInput.getName(), UNIQUE_STATUSES)).thenReturn(true);

        assertThatThrownBy(() -> scriptService.create(createInput, "user-1", ScriptCreationSource.MANUAL))
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
        when(scriptRepository.existsByTenantIdAndNameAndStatusIn(TENANT_ID, createInput.getName(), UNIQUE_STATUSES)).thenReturn(false);
        when(scriptMapper.toEntity(TENANT_ID, createInput)).thenReturn(mapped);
        when(scriptRepository.save(mapped)).thenReturn(saved);
        when(scriptMapper.toResponse(saved)).thenReturn(ScriptResponse.builder().id(SCRIPT_ID).build());

        ScriptResponse result = scriptService.create(createInput, "user-1", ScriptCreationSource.MANUAL);

        assertThat(result.getId()).isEqualTo(SCRIPT_ID);
    }

    @Test
    @DisplayName("create: the creation source is stamped on the entity before save — AI_ASSISTANT for Mingo-authored scripts")
    void create_aiAssistant_stampsCreationSource() {
        // setup
        Script mapped = new Script();
        Script saved = new Script();
        saved.setId(SCRIPT_ID);
        when(scriptRepository.existsByTenantIdAndNameAndStatusIn(TENANT_ID, createInput.getName(), UNIQUE_STATUSES)).thenReturn(false);
        when(scriptMapper.toEntity(TENANT_ID, createInput)).thenReturn(mapped);
        when(scriptRepository.save(mapped)).thenReturn(saved);
        when(scriptMapper.toResponse(saved)).thenReturn(ScriptResponse.builder().id(SCRIPT_ID).build());

        // execution
        scriptService.create(createInput, "user-1", ScriptCreationSource.AI_ASSISTANT);

        // verifications
        assertThat(mapped.getCreationSource()).isEqualTo(ScriptCreationSource.AI_ASSISTANT);
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
        stubIdCursors();
        Script s1 = new Script();
        s1.setId("id-1");
        Script s2 = new Script();
        s2.setId("id-2");
        Script s3 = new Script();
        s3.setId("id-3");
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(2).cursor(null).backward(false).build();

        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq(null), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq(NO_POSITION), eq(false), eq(3)))
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
        stubIdCursors();
        Script s1 = new Script();
        s1.setId("id-1");
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(10).cursor(SCRIPT_ID).backward(false).build();

        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq(null), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq(new CursorPosition.RowId(SCRIPT_ID)), eq(false), eq(11)))
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
        stubIdCursors();
        Script s1 = new Script();
        s1.setId("id-1");
        Script s2 = new Script();
        s2.setId("id-2");
        Script s3 = new Script();
        s3.setId("id-3");
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(2).cursor(SCRIPT_ID).backward(true).build();

        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq(null), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq(new CursorPosition.RowId(SCRIPT_ID)), eq(true), eq(3)))
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
                eq("_id"), eq(Sort.Direction.DESC), eq(NO_POSITION), eq(false), eq(21)))
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
                eq("_id"), eq(Sort.Direction.DESC), eq(NO_POSITION), eq(false),
                eq(CursorPaginationCriteria.DEFAULT_PAGE_SIZE + 1))).thenReturn(List.of());

        scriptService.list(null, null, null, raw);

        verify(scriptRepository).findPageForTenant(eq(TENANT_ID), eq(null), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq(NO_POSITION), eq(false),
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
                eq("name"), eq(Sort.Direction.ASC), eq(NO_POSITION), eq(false), eq(21)))
                .thenReturn(List.of());

        scriptService.list(filter, "backup", sort, criteria);

        org.mockito.ArgumentCaptor<ScriptQueryFilter> filterCaptor =
                org.mockito.ArgumentCaptor.forClass(ScriptQueryFilter.class);
        verify(scriptRepository).findPageForTenant(eq(TENANT_ID), filterCaptor.capture(), eq("backup"),
                eq("name"), eq(Sort.Direction.ASC), eq(NO_POSITION), eq(false), eq(21));
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
                eq("_id"), eq(Sort.Direction.DESC), eq(NO_POSITION), eq(false), eq(21)))
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
                eq("_id"), eq(Sort.Direction.DESC), eq(NO_POSITION), eq(false), eq(11)))
                .thenReturn(List.of());

        scriptService.list(null, null, sort, criteria);

        verify(scriptRepository).findPageForTenant(eq(TENANT_ID), eq(null), eq(null),
                eq("_id"), eq(Sort.Direction.DESC), eq(NO_POSITION), eq(false), eq(11));
    }

    @ParameterizedTest
    @MethodSource("sortsOverRowsWithEqualValues")
    void list_pageOneThenPageTwoThenBeforePageTwo_returnsPageOneAgain(
            SortInput sort, List<String> pageOneRows, List<String> pageTwoRows) {
        // setup
        stubScriptPages(sort);

        // execution
        CountedGenericQueryResult<ScriptResponse> pageOne = scriptService.list(null, null, sort, forward(2, null));
        CountedGenericQueryResult<ScriptResponse> pageTwo =
                scriptService.list(null, null, sort, forward(2, pageOne.getPageInfo().getEndCursor()));
        CountedGenericQueryResult<ScriptResponse> backToPageOne =
                scriptService.list(null, null, sort, backward(2, pageTwo.getPageInfo().getStartCursor()));

        // verifications
        assertThat(pageOne.getItems()).extracting(ScriptResponse::getId).containsExactlyElementsOf(pageOneRows);
        assertThat(pageTwo.getItems()).extracting(ScriptResponse::getId).containsExactlyElementsOf(pageTwoRows);
        assertThat(backToPageOne.getItems()).extracting(ScriptResponse::getId).containsExactlyElementsOf(pageOneRows);
        assertThat(backToPageOne.getPageInfo())
                .returns(pageOne.getPageInfo().getStartCursor(), PageInfo::getStartCursor)
                .returns(pageOne.getPageInfo().getEndCursor(), PageInfo::getEndCursor);
    }

    @ParameterizedTest
    @MethodSource("pagesOfFiveRows")
    void list_eachPageInEachDirection_rowsInDisplayOrderWithBothFlags(
            boolean backward, int anchorRow, List<String> expectedRows, boolean hasPreviousPage, boolean hasNextPage) {
        // setup
        SortInput sort = SortInput.builder().field(NAME).direction(SortDirection.ASC).build();
        stubScriptPages(sort);
        String cursor = nameCursorOfRow(anchorRow);
        CursorPaginationCriteria pagination = connectionPage(backward, 2, cursor);

        // execution
        CountedGenericQueryResult<ScriptResponse> result = scriptService.list(null, null, sort, pagination);

        // verifications
        assertThat(result.getItems()).extracting(ScriptResponse::getId).containsExactlyElementsOf(expectedRows);
        assertThat(result.getPageInfo())
                .returns(hasPreviousPage, PageInfo::isHasPreviousPage)
                .returns(hasNextPage, PageInfo::isHasNextPage);
    }

    @Test
    void list_lastWithoutBefore_lastRowsInDisplayOrderAndNoNextPage() {
        // setup
        SortInput sort = SortInput.builder().field(NAME).direction(SortDirection.ASC).build();
        stubScriptPages(sort);

        // execution
        CountedGenericQueryResult<ScriptResponse> result = scriptService.list(null, null, sort, backward(2, null));

        // verifications
        assertThat(result.getItems()).extracting(ScriptResponse::getId).containsExactly(ROW_4, ROW_5);
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
        verify(scriptRepository).findPageForTenant(eq(TENANT_ID), isNull(), isNull(),
                eq(NAME), eq(Sort.Direction.ASC), eq(NO_POSITION), eq(true), eq(3));
    }

    @ParameterizedTest
    @MethodSource("keysetsOfTheFirstTwoRows")
    void list_pageInfoCursors_keysetCursorsOfTheFirstAndLastShownRows(
            SortInput sort, KeysetCursor expectedStart, KeysetCursor expectedEnd) {
        // setup
        stubScriptPages(sort);

        // execution
        PageInfo pageInfo = scriptService.list(null, null, sort, forward(2, null)).getPageInfo();

        // verifications
        assertThat(KeysetCursor.parse(pageInfo.getStartCursor())).isEqualTo(expectedStart);
        assertThat(KeysetCursor.parse(pageInfo.getEndCursor())).isEqualTo(expectedEnd);
        assertThat(CursorBase64.decode(pageInfo.getStartCursor())).startsWith(KEYSET_PREFIX);
        assertThat(CursorBase64.decode(pageInfo.getEndCursor())).startsWith(KEYSET_PREFIX);
    }

    @Test
    void list_plainRowIdWhoseRowIsGoneUnderTheDefaultSort_pagesOnFromThatPosition() {
        // setup
        stubScriptPages(null);
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).cursor(GONE_ROW).build();

        // execution
        CountedGenericQueryResult<ScriptResponse> result = scriptService.list(null, null, null, pagination);

        // verifications
        assertThat(result.getItems()).extracting(ScriptResponse::getId).containsExactly(ROW_3, ROW_2);
        assertThat(result.getPageInfo())
                .returns(true, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
        verify(scriptRepository).findPageForTenant(eq(TENANT_ID), isNull(), isNull(),
                eq(ID), eq(Sort.Direction.DESC), eq(new CursorPosition.RowId(GONE_ROW)), eq(false), eq(3));
    }

    @Test
    void list_base64RowIdOfAnOlderPageCursor_stillPagesPastThatRow() {
        // setup
        stubScriptPages(null);
        CursorPaginationCriteria pagination = forward(2, CursorCodec.encode(ROW_4));

        // execution
        CountedGenericQueryResult<ScriptResponse> result = scriptService.list(null, null, null, pagination);

        // verifications
        assertThat(result.getItems()).extracting(ScriptResponse::getId).containsExactly(ROW_3, ROW_2);
        verify(scriptRepository).findPageForTenant(eq(TENANT_ID), isNull(), isNull(),
                eq(ID), eq(Sort.Direction.DESC), eq(new CursorPosition.RowId(ROW_4)), eq(false), eq(3));
    }

    @Test
    void list_decodedKeysetCursorBackward_repositoryGetsTheKeysetPositionAndTheDirection() {
        // setup
        SortInput sort = SortInput.builder().field(NAME).direction(SortDirection.ASC).build();
        when(scriptRepository.isSortableField(NAME)).thenReturn(true);
        KeysetCursor cursor = KeysetCursor.ofString(NAME, Sort.Direction.ASC, "beta", ROW_3);
        CursorPaginationCriteria pagination = backward(2, cursor.encode());

        // execution
        scriptService.list(null, null, sort, pagination);

        // verifications
        verify(scriptRepository).findPageForTenant(eq(TENANT_ID), isNull(), isNull(),
                eq(NAME), eq(Sort.Direction.ASC), eq(cursor), eq(true), eq(3));
    }

    @Test
    void list_cursorInAnotherFormat_leftToTheRepositoryToReject() {
        // setup
        stubSortAllowlistDefault();
        CursorPosition unrecognised = new CursorPosition.Unrecognised("not-a-script-cursor");
        when(scriptRepository.findPageForTenant(eq(TENANT_ID), isNull(), isNull(),
                eq(ID), eq(Sort.Direction.DESC), eq(unrecognised), eq(false), eq(3)))
                .thenThrow(new InvalidCursorException());
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).cursor("not-a-script-cursor").build();

        // execution
        Throwable thrown = catchThrowable(() -> scriptService.list(null, null, null, pagination));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
    }

    @Test
    void list_malformedKeysetPayload_throwsInvalidCursorBeforeAnyPageIsRead() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).cursor("k1|name|ASC").build();

        // execution
        Throwable thrown = catchThrowable(() -> scriptService.list(null, null, null, pagination));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(scriptRepository, never()).findPageForTenant(any(), any(), any(), any(), any(),
                any(CursorPosition.class), anyBoolean(), anyInt());
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
        // the batches still waiting for a machine carry the edited script
        verify(deliveryRefresher).refreshForScript(SCRIPT_ID);
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
        when(scriptRepository.existsByTenantIdAndNameAndIdNotAndStatusIn(TENANT_ID, "taken name", SCRIPT_ID, UNIQUE_STATUSES)).thenReturn(true);

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

        verify(scriptRepository, never()).existsByTenantIdAndNameAndIdNotAndStatusIn(any(), any(), any(), any());
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

        verify(scriptRepository, never()).existsByTenantIdAndNameAndIdNotAndStatusIn(any(), any(), any(), any());
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
        verify(deliveryRefresher).refreshForScript(SCRIPT_ID);
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
        verify(deliveryRefresher).refreshForScript(SCRIPT_ID);
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

    @Test
    @DisplayName("update: system scripts are immutable — rejected before any name check or save")
    void update_rejectsSystemScript() {
        Script system = new Script();
        system.setId(SCRIPT_ID);
        system.setStatus(ScriptStatus.ACTIVE);
        system.setType(com.openframe.data.document.rmm.script.ScriptType.SYSTEM);
        updateInput.setName("renamed");
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(system));

        assertThatThrownBy(() -> scriptService.update(updateInput))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Managed scripts");

        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("delete: system scripts cannot be deleted")
    void delete_rejectsSystemScript() {
        Script system = new Script();
        system.setId(SCRIPT_ID);
        system.setStatus(ScriptStatus.ACTIVE);
        system.setType(com.openframe.data.document.rmm.script.ScriptType.SYSTEM);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(system));

        assertThatThrownBy(() -> scriptService.delete(SCRIPT_ID))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Managed scripts");

        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("archive: system scripts cannot be archived")
    void archive_rejectsSystemScript() {
        Script system = new Script();
        system.setId(SCRIPT_ID);
        system.setStatus(ScriptStatus.ACTIVE);
        system.setType(com.openframe.data.document.rmm.script.ScriptType.SYSTEM);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(system));

        assertThatThrownBy(() -> scriptService.archive(SCRIPT_ID))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Managed scripts");

        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("unarchive: system scripts cannot be unarchived")
    void unarchive_rejectsSystemScript() {
        Script system = new Script();
        system.setId(SCRIPT_ID);
        system.setStatus(ScriptStatus.ARCHIVED);
        system.setType(com.openframe.data.document.rmm.script.ScriptType.SYSTEM);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(system));

        assertThatThrownBy(() -> scriptService.unarchive(SCRIPT_ID))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Managed scripts");

        verify(scriptRepository, never()).save(any());
    }

    private static Stream<Arguments> sortsOverRowsWithEqualValues() {
        return Stream.of(
                arguments(null, List.of(ROW_5, ROW_4), List.of(ROW_3, ROW_2)),
                arguments(sortBy(ID, SortDirection.ASC), List.of(ROW_1, ROW_2), List.of(ROW_3, ROW_4)),
                arguments(sortBy(NAME, SortDirection.ASC), List.of(ROW_1, ROW_2), List.of(ROW_3, ROW_4)),
                arguments(sortBy(NAME, SortDirection.DESC), List.of(ROW_5, ROW_4), List.of(ROW_3, ROW_2)),
                arguments(sortBy(CREATED_AT, SortDirection.ASC), List.of(ROW_1, ROW_2), List.of(ROW_3, ROW_4)),
                arguments(sortBy(CREATED_AT, SortDirection.DESC), List.of(ROW_5, ROW_4), List.of(ROW_3, ROW_2)),
                arguments(sortBy(UPDATED_AT, SortDirection.ASC), List.of(ROW_5, ROW_2), List.of(ROW_3, ROW_4)),
                arguments(sortBy(UPDATED_AT, SortDirection.DESC), List.of(ROW_1, ROW_4), List.of(ROW_3, ROW_2)));
    }

    private static Stream<Arguments> pagesOfFiveRows() {
        return Stream.of(
                arguments(false, 0, List.of(ROW_1, ROW_2), false, true),
                arguments(false, 2, List.of(ROW_3, ROW_4), true, true),
                arguments(false, 4, List.of(ROW_5), true, false),
                arguments(false, 5, List.of(), true, false),
                arguments(true, 0, List.of(ROW_4, ROW_5), true, false),
                arguments(true, 4, List.of(ROW_2, ROW_3), true, true),
                arguments(true, 3, List.of(ROW_1, ROW_2), false, true),
                arguments(true, 2, List.of(ROW_1), false, true),
                arguments(true, 1, List.of(), false, true));
    }

    private static Stream<Arguments> keysetsOfTheFirstTwoRows() {
        return Stream.of(
                arguments(null,
                        new KeysetCursor(ID, Sort.Direction.DESC, "", ROW_5),
                        new KeysetCursor(ID, Sort.Direction.DESC, "", ROW_4)),
                arguments(sortBy(NAME, SortDirection.ASC),
                        KeysetCursor.ofString(NAME, Sort.Direction.ASC, "alpha", ROW_1),
                        KeysetCursor.ofString(NAME, Sort.Direction.ASC, "beta", ROW_2)),
                arguments(sortBy(CREATED_AT, SortDirection.DESC),
                        KeysetCursor.ofInstant(CREATED_AT, Sort.Direction.DESC, LATE, ROW_5),
                        KeysetCursor.ofInstant(CREATED_AT, Sort.Direction.DESC, MIDDLE, ROW_4)),
                arguments(sortBy(UPDATED_AT, SortDirection.ASC),
                        KeysetCursor.ofInstant(UPDATED_AT, Sort.Direction.ASC, EARLY, ROW_5),
                        KeysetCursor.ofInstant(UPDATED_AT, Sort.Direction.ASC, MIDDLE, ROW_2)));
    }

    private static SortInput sortBy(String field, SortDirection direction) {
        return SortInput.builder().field(field).direction(direction).build();
    }

    private static CursorPaginationCriteria forward(int first, String after) {
        ConnectionArgs args = ConnectionArgs.builder().first(first).after(after).build();
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    private static CursorPaginationCriteria backward(int last, String before) {
        ConnectionArgs args = ConnectionArgs.builder().last(last).before(before).build();
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    private static CursorPaginationCriteria connectionPage(boolean backward, int limit, String cursor) {
        return backward ? backward(limit, cursor) : forward(limit, cursor);
    }

    private static List<Script> scripts() {
        return List.of(
                script(ROW_1, "alpha", EARLY, LATE),
                script(ROW_2, "beta", MIDDLE, MIDDLE),
                script(ROW_3, "beta", MIDDLE, MIDDLE),
                script(ROW_4, "beta", MIDDLE, MIDDLE),
                script(ROW_5, "gamma", LATE, EARLY));
    }

    private static Script script(String id, String name, Instant createdAt, Instant updatedAt) {
        return Script.builder().id(id).name(name).createdAt(createdAt).updatedAt(updatedAt).build();
    }

    private static ScriptResponse response(Script script) {
        return ScriptResponse.builder().id(script.getId()).name(script.getName()).build();
    }

    private static List<Script> rowsPast(String sortField, Sort.Direction direction, CursorPosition position,
                                         boolean backward, int limit) {
        Comparator<Script> displayOrder = displayOrder(sortField, direction);
        Comparator<Script> fetchOrder = backward ? displayOrder.reversed() : displayOrder;
        Optional<Script> anchor = anchorOf(position, sortField);
        return scripts().stream()
                .sorted(fetchOrder)
                .filter(row -> anchor.map(past -> fetchOrder.compare(row, past) > 0).orElse(true))
                .limit(limit)
                .toList();
    }

    private static Comparator<Script> displayOrder(String sortField, Sort.Direction direction) {
        Comparator<Script> ascending = switch (sortField) {
            case NAME -> Comparator.comparing(Script::getName).thenComparing(Script::getId);
            case CREATED_AT -> Comparator.comparing(Script::getCreatedAt).thenComparing(Script::getId);
            case UPDATED_AT -> Comparator.comparing(Script::getUpdatedAt).thenComparing(Script::getId);
            default -> Comparator.comparing(Script::getId);
        };
        return direction.isAscending() ? ascending : ascending.reversed();
    }

    private static Optional<Script> anchorOf(CursorPosition position, String sortField) {
        return switch (position) {
            case KeysetCursor keyset -> Optional.of(anchorRow(keyset, sortField));
            case CursorPosition.RowId rowId when ID.equals(sortField) -> Optional.of(script(rowId.id(), null, null, null));
            case CursorPosition.RowId rowId ->
                    throw new IllegalStateException("A row id under the " + sortField + " sort carries no sort value");
            case CursorPosition.Unrecognised unrecognised -> throw new InvalidCursorException();
            case CursorPosition.None none -> Optional.empty();
        };
    }

    private static Script anchorRow(KeysetCursor keyset, String sortField) {
        return switch (sortField) {
            case NAME -> script(keyset.id(), keyset.stringValue(), null, null);
            case CREATED_AT -> script(keyset.id(), null, keyset.instantValue(), null);
            case UPDATED_AT -> script(keyset.id(), null, null, keyset.instantValue());
            default -> script(keyset.id(), null, null, null);
        };
    }

    private String nameCursorOfRow(int row) {
        return row == 0 ? null : cursorIssuer.keysetCursor(scripts().get(row - 1), NAME, Sort.Direction.ASC).encode();
    }

    private void stubIdCursors() {
        lenient().when(scriptRepository.keysetCursor(any(Script.class), eq(ID), eq(Sort.Direction.DESC)))
                .thenAnswer(call -> new KeysetCursor(ID, Sort.Direction.DESC, "", call.<Script>getArgument(0).getId()));
    }

    private void stubSortResolution(SortInput sort) {
        if (sort == null) {
            when(scriptRepository.getDefaultSortField()).thenReturn(ID);
        } else {
            when(scriptRepository.isSortableField(sort.getField())).thenReturn(true);
        }
    }

    private void stubScriptPages(SortInput sort) {
        String sortField = sort == null ? ID : sort.getField();
        Sort.Direction direction = sort != null && sort.getDirection() == SortDirection.ASC
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        stubSortResolution(sort);
        when(scriptRepository.findPageForTenant(eq(TENANT_ID), isNull(), isNull(), eq(sortField), eq(direction),
                any(CursorPosition.class), anyBoolean(), anyInt()))
                .thenAnswer(call -> rowsPast(sortField, direction,
                        call.getArgument(5), call.getArgument(6), call.getArgument(7)));
        lenient().when(scriptRepository.keysetCursor(any(Script.class), eq(sortField), eq(direction)))
                .thenAnswer(call -> cursorIssuer.keysetCursor(call.getArgument(0), sortField, direction));
        lenient().when(scriptMapper.toResponse(any(Script.class)))
                .thenAnswer(call -> response(call.getArgument(0)));
    }
}
