package com.openframe.api.service.rmm;

import com.openframe.api.dto.script.CreateScriptInput;
import com.openframe.api.dto.script.ScriptEnvVarDto;
import com.openframe.api.dto.script.ScriptPageResponse;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.script.UpdateScriptInput;
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
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

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

    // ---------- create ----------

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
                ScriptEnvVarDto.builder().name("LOG_LEVEL").value("INFO").secret(false).build(),
                ScriptEnvVarDto.builder().name("API_TOKEN").value("xyz").secret(true).build()
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

    // ---------- get ----------

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

    // ---------- list ----------

    @Test
    @DisplayName("list: delegates to the repository with the correct Pageable and returns the mapped page response")
    void list_delegatesToRepoWithPageable() {
        Page<Script> page = new PageImpl<>(List.of(new Script()));
        ScriptPageResponse pageResponse = ScriptPageResponse.builder().build();
        when(scriptRepository.findAllByTenantId(eq(TENANT_ID), any(Pageable.class))).thenReturn(page);
        when(scriptMapper.toPageResponse(page)).thenReturn(pageResponse);

        ScriptPageResponse result = scriptService.list(TENANT_ID, 2, 50);

        assertThat(result).isSameAs(pageResponse);
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(scriptRepository).findAllByTenantId(eq(TENANT_ID), pageableCaptor.capture());
        Pageable captured = pageableCaptor.getValue();
        assertThat(captured.getPageNumber()).isEqualTo(2);
        assertThat(captured.getPageSize()).isEqualTo(50);
        assertThat(captured).isEqualTo(PageRequest.of(2, 50));
    }

    // ---------- update ----------

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

    // ---------- delete ----------

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
