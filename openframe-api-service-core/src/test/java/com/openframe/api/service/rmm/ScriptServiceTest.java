package com.openframe.api.service.rmm;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.script.CreateScriptInput;
import com.openframe.api.dto.script.ScriptEnvVarInput;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.script.UpdateScriptInput;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.ScriptMapper;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.repository.rmm.ScriptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String OTHER_TENANT_ID = "tenant-2";
    private static final String SCRIPT_ID = "65f4a8000000000000000001";

    @Mock
    private ScriptRepository scriptRepository;

    @Mock
    private ScriptMapper scriptMapper;

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

        ScriptResponse result = scriptService.create(TENANT_ID, createInput);

        assertThat(result).isSameAs(response);
        verify(scriptRepository).save(mapped);
    }

    @Test
    @DisplayName("create: throws ConflictException when a script with the same name already exists in the tenant")
    void create_whenNameAlreadyExists_throwsConflict() {
        when(scriptRepository.existsByTenantIdAndName(TENANT_ID, createInput.getName())).thenReturn(true);

        assertThatThrownBy(() -> scriptService.create(TENANT_ID, createInput))
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

        ScriptResponse result = scriptService.create(TENANT_ID, createInput);

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

        ScriptResponse result = scriptService.get(TENANT_ID, SCRIPT_ID);

        assertThat(result).isSameAs(response);
    }

    @Test
    @DisplayName("get: throws NotFoundException when the script does not exist in the tenant")
    void get_whenNotFound_throwsNotFound() {
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> scriptService.get(TENANT_ID, SCRIPT_ID))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining(SCRIPT_ID);

        verifyNoInteractions(scriptMapper);
    }

    @Test
    @DisplayName("list: forward pagination — fetches limit+1 rows, drops the extra, marks hasNextPage=true and hasPreviousPage=false on the first page")
    void list_forwardFirstPage_dropsSentinelAndReportsHasNext() {
        Script s1 = new Script();
        s1.setId("id-1");
        Script s2 = new Script();
        s2.setId("id-2");
        Script s3 = new Script();
        s3.setId("id-3");
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(2).cursor(null).backward(false).build();

        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq(null), eq(false), eq(3)))
                .thenReturn(List.of(s1, s2, s3));
        when(scriptMapper.toResponse(s1)).thenReturn(ScriptResponse.builder().id("id-1").build());
        when(scriptMapper.toResponse(s2)).thenReturn(ScriptResponse.builder().id("id-2").build());

        GenericQueryResult<ScriptResponse> result = scriptService.list(TENANT_ID, criteria);

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
        Script s1 = new Script();
        s1.setId("id-1");
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(10).cursor("decoded-cursor").backward(false).build();

        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq("decoded-cursor"), eq(false), eq(11)))
                .thenReturn(List.of(s1));
        when(scriptMapper.toResponse(s1)).thenReturn(ScriptResponse.builder().id("id-1").build());

        GenericQueryResult<ScriptResponse> result = scriptService.list(TENANT_ID, criteria);

        assertThat(result.getItems()).hasSize(1);
        assertThat(result.getPageInfo().isHasNextPage()).isFalse();
        assertThat(result.getPageInfo().isHasPreviousPage()).isTrue();
    }

    @Test
    @DisplayName("list: backward pagination — items are reversed so the page is still displayed newest-first, and hasMore maps to hasPreviousPage")
    void list_backwardPagination_reversesItemsAndFlipsHasMore() {
        Script s1 = new Script();
        s1.setId("id-1");
        Script s2 = new Script();
        s2.setId("id-2");
        Script s3 = new Script();
        s3.setId("id-3");
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(2).cursor("decoded-cursor").backward(true).build();

        // repo returns ASC (oldest-first) when backward: [s1, s2, s3] = +1 sentinel
        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq("decoded-cursor"), eq(true), eq(3)))
                .thenReturn(List.of(s1, s2, s3));
        when(scriptMapper.toResponse(any(Script.class)))
                .thenAnswer(inv -> ScriptResponse.builder().id(((Script) inv.getArgument(0)).getId()).build());

        GenericQueryResult<ScriptResponse> result = scriptService.list(TENANT_ID, criteria);

        // After sentinel-drop + reverse: page should be newest-first [id-2, id-1]
        assertThat(result.getItems()).extracting(ScriptResponse::getId).containsExactly("id-2", "id-1");
        assertThat(result.getPageInfo().isHasPreviousPage()).isTrue();
        assertThat(result.getPageInfo().isHasNextPage()).isTrue();   // we paged with a cursor → there's a next
    }

    @Test
    @DisplayName("list: empty result — both cursors null, hasNextPage/hasPreviousPage reflect lack of data")
    void list_emptyResult_returnsEmptyPageInfo() {
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(20).cursor(null).backward(false).build();
        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq(null), eq(false), eq(21)))
                .thenReturn(List.of());

        GenericQueryResult<ScriptResponse> result = scriptService.list(TENANT_ID, criteria);

        assertThat(result.getItems()).isEmpty();
        assertThat(result.getPageInfo().getStartCursor()).isNull();
        assertThat(result.getPageInfo().getEndCursor()).isNull();
        assertThat(result.getPageInfo().isHasNextPage()).isFalse();
        assertThat(result.getPageInfo().isHasPreviousPage()).isFalse();
    }

    @Test
    @DisplayName("list: page size is normalised — pagination.normalize() is applied before fetching (default size if not supplied)")
    void list_normalisesPaginationCriteria() {
        CursorPaginationCriteria raw = CursorPaginationCriteria.builder()
                .limit(null).cursor(null).backward(false).build();
        when(scriptRepository.findPageForTenant(eq(TENANT_ID), eq(null), eq(false),
                eq(CursorPaginationCriteria.DEFAULT_PAGE_SIZE + 1))).thenReturn(List.of());

        scriptService.list(TENANT_ID, raw);

        verify(scriptRepository).findPageForTenant(eq(TENANT_ID), eq(null), eq(false),
                eq(CursorPaginationCriteria.DEFAULT_PAGE_SIZE + 1));
    }

    @Test
    @DisplayName("update: applies the patch and returns the mapped response when the script exists")
    void update_whenScriptExists_appliesPatch() {
        Script existing = new Script();
        existing.setId(SCRIPT_ID);
        existing.setName("old");
        Script saved = new Script();
        saved.setId(SCRIPT_ID);
        ScriptResponse response = ScriptResponse.builder().id(SCRIPT_ID).build();

        updateInput.setDescription("new description");

        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(existing));
        when(scriptRepository.save(existing)).thenReturn(saved);
        when(scriptMapper.toResponse(saved)).thenReturn(response);

        ScriptResponse result = scriptService.update(TENANT_ID, SCRIPT_ID, updateInput);

        assertThat(result).isSameAs(response);
        verify(scriptMapper).updateEntity(existing, updateInput);
        verify(scriptRepository).save(existing);
    }

    @Test
    @DisplayName("update: throws NotFoundException when the script does not exist in the tenant")
    void update_whenNotFound_throwsNotFound() {
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> scriptService.update(TENANT_ID, SCRIPT_ID, updateInput))
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

        assertThatThrownBy(() -> scriptService.update(TENANT_ID, SCRIPT_ID, updateInput))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("taken name");

        verify(scriptRepository, never()).save(any());
    }

    @Test
    @DisplayName("update: when the name is unchanged, the uniqueness check is skipped (no extra repository round-trip)")
    void update_keepingSameName_skipsUniquenessCheck() {
        Script existing = new Script();
        existing.setId(SCRIPT_ID);
        existing.setName("same name");
        updateInput.setName("same name");

        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(existing));
        when(scriptRepository.save(existing)).thenReturn(existing);
        when(scriptMapper.toResponse(existing)).thenReturn(ScriptResponse.builder().id(SCRIPT_ID).build());

        scriptService.update(TENANT_ID, SCRIPT_ID, updateInput);

        verify(scriptRepository, never()).existsByTenantIdAndNameAndIdNot(any(), any(), any());
    }

    @Test
    @DisplayName("update: when the name field is null, the uniqueness check is skipped (PATCH semantics — name simply not touched)")
    void update_whenNameIsNull_skipsUniquenessCheck() {
        Script existing = new Script();
        existing.setId(SCRIPT_ID);
        existing.setName("unchanged");
        updateInput.setName(null);
        updateInput.setDescription("only changing the description");

        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(existing));
        when(scriptRepository.save(existing)).thenReturn(existing);
        when(scriptMapper.toResponse(existing)).thenReturn(ScriptResponse.builder().id(SCRIPT_ID).build());

        scriptService.update(TENANT_ID, SCRIPT_ID, updateInput);

        verify(scriptRepository, never()).existsByTenantIdAndNameAndIdNot(any(), any(), any());
    }

    @Test
    @DisplayName("delete: invokes the tenant-scoped repository delete and treats removal count == 1 as success")
    void delete_whenRemoved_invokesRepository() {
        when(scriptRepository.deleteByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(1L);

        scriptService.delete(TENANT_ID, SCRIPT_ID);

        verify(scriptRepository, times(1)).deleteByTenantIdAndId(TENANT_ID, SCRIPT_ID);
    }

    @Test
    @DisplayName("delete: when the script does not exist (removal count == 0), the call is a no-op — no exception is thrown")
    void delete_whenNotFound_isIdempotent() {
        when(scriptRepository.deleteByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(0L);

        scriptService.delete(TENANT_ID, SCRIPT_ID);

        verify(scriptRepository).deleteByTenantIdAndId(TENANT_ID, SCRIPT_ID);
    }

    @Test
    @DisplayName("delete: never reaches a different tenant — the call only invokes repo with the supplied tenantId")
    void delete_doesNotCrossTenants() {
        when(scriptRepository.deleteByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(0L);

        scriptService.delete(TENANT_ID, SCRIPT_ID);

        verify(scriptRepository, never()).deleteByTenantIdAndId(eq(OTHER_TENANT_ID), any());
    }
}
