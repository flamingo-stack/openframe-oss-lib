package com.openframe.api.service.rmm.script;

import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptFeasibilityTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SCRIPT_ID = "script-1";

    @Mock private ScriptRepository scriptRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private ScriptService service;

    @Test
    void requireExisting_deletedScript_preservesRepeatDeleteEligibility() {
        // setup
        Script script = Script.builder().status(ScriptStatus.DELETED).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(script));

        // execution
        Script result = service.requireExisting(SCRIPT_ID);

        // verifications
        assertThat(result.getStatus()).isEqualTo(ScriptStatus.DELETED);
        verify(scriptRepository, never()).save(any());
    }

    @Test
    void get_deletedScript_preservesVisibleLookupRejection() {
        // setup
        Script script = Script.builder().status(ScriptStatus.DELETED).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(script));

        // execution
        Throwable failure = catchThrowable(() -> service.get(SCRIPT_ID));

        // verifications
        assertThat(failure).isInstanceOf(NotFoundException.class);
        verify(scriptRepository, never()).save(any());
    }

    @Test
    void requireNameAvailable_existingActiveOrArchivedName_rejectsWithoutWrite() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        List<ScriptStatus> statuses = List.of(ScriptStatus.ACTIVE, ScriptStatus.ARCHIVED);
        when(scriptRepository.existsByTenantIdAndNameAndStatusIn(TENANT_ID, "script-name", statuses)).thenReturn(true);

        // execution
        Throwable failure = catchThrowable(() -> service.requireNameAvailable("script-name"));

        // verifications
        assertThat(failure).isInstanceOf(ConflictException.class);
        verify(scriptRepository, never()).save(any());
    }
}
