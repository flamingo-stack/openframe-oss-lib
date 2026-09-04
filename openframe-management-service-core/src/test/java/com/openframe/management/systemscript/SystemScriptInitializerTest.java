package com.openframe.management.systemscript;

import com.openframe.data.document.rmm.bootstrap.SystemScriptCode;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SystemScriptInitializerTest {

    private static final String TENANT_ID = "tenant-1";

    private ScriptRepository scriptRepository;
    private SystemScriptInitializer initializer;

    @BeforeEach
    void setUp() {
        scriptRepository = mock(ScriptRepository.class);
        TenantIdProvider tenantIdProvider = mock(TenantIdProvider.class);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        initializer = new SystemScriptInitializer(scriptRepository, tenantIdProvider);
    }

    @Test
    void seedsAllScriptsWhenAbsent() {
        when(scriptRepository.findSystemScript(any(), any())).thenReturn(Optional.empty());
        when(scriptRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        initializer.run(null);

        ArgumentCaptor<Script> saved = ArgumentCaptor.forClass(Script.class);
        verify(scriptRepository, times(3)).save(saved.capture());
        List<Script> scripts = saved.getAllValues();

        Script brew = byName(scripts, SystemScriptCode.INSTALL_BREW.canonicalName());
        assertEquals(TENANT_ID, brew.getTenantId());
        assertTrue(brew.getSystem());
        assertEquals(ScriptShell.BASH, brew.getShell());
        assertEquals(PrivilegeLevel.ADMIN, brew.getPrivilegeLevel());
        assertEquals(ScriptStatus.ACTIVE, brew.getStatus());
        assertNotNull(brew.getContentHash());
        assertTrue(brew.getScriptBody().contains("tar xz --strip-components 1"));
        // the installer must never run brew itself as root
        assertTrue(brew.getScriptBody().contains("sudo -u \"$CONSOLE_USER\""));

        Script choco = byName(scripts, SystemScriptCode.INSTALL_CHOCOLATEY.canonicalName());
        assertEquals(ScriptShell.POWERSHELL, choco.getShell());
        assertTrue(choco.getScriptBody().contains("community.chocolatey.org/install.ps1"));
        assertTrue(choco.getScriptBody().trim().endsWith("exit $LASTEXITCODE"));

        Script winget = byName(scripts, SystemScriptCode.INSTALL_WINGET.canonicalName());
        assertTrue(winget.getScriptBody().contains("Repair-WinGetPackageManager -AllUsers"));
    }

    @Test
    void refreshesTheScriptWhenTheShippedBodyChanged() {
        Script stale = new Script();
        stale.setName(SystemScriptCode.INSTALL_BREW.canonicalName());
        stale.setSystem(true);
        stale.setContentHash("stale-hash");
        when(scriptRepository.findSystemScript(any(), any())).thenAnswer(inv ->
                inv.getArgument(0) == SystemScriptCode.INSTALL_BREW ? Optional.of(stale) : Optional.empty());
        when(scriptRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        initializer.run(null);

        assertTrue(stale.getScriptBody().contains("tar xz --strip-components 1"));
        assertNotNull(stale.getContentHash());
        assertTrue(!"stale-hash".equals(stale.getContentHash()));
    }

    @Test
    void leavesUpToDateScriptsUntouched() {
        when(scriptRepository.findSystemScript(any(), any())).thenReturn(Optional.empty());
        when(scriptRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        initializer.run(null);
        ArgumentCaptor<Script> seeded = ArgumentCaptor.forClass(Script.class);
        verify(scriptRepository, times(3)).save(seeded.capture());

        ScriptRepository secondRepo = mock(ScriptRepository.class);
        TenantIdProvider tenantIdProvider = mock(TenantIdProvider.class);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        for (Script script : seeded.getAllValues()) {
            SystemScriptCode code = codeByName(script.getName());
            when(secondRepo.findSystemScript(code, TENANT_ID)).thenReturn(Optional.of(script));
        }

        new SystemScriptInitializer(secondRepo, tenantIdProvider).run(null);

        verify(secondRepo, never()).save(any());
    }

    private static Script byName(List<Script> scripts, String name) {
        return scripts.stream()
                .filter(script -> name.equals(script.getName()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("script not seeded: " + name));
    }

    private static SystemScriptCode codeByName(String canonicalName) {
        for (SystemScriptCode code : SystemScriptCode.values()) {
            if (code.canonicalName().equals(canonicalName)) {
                return code;
            }
        }
        throw new AssertionError("unknown canonical name: " + canonicalName);
    }
}
