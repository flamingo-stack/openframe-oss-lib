package com.openframe.management.migration;

import com.openframe.data.document.rmm.bootstrap.SystemScriptCode;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.script.ScriptType;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.management.systemscript.SoftwareScriptDefinition;
import com.openframe.management.systemscript.SystemScriptDefinition;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Arrays;
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

class SeedManagedScriptsChangeUnitTest {

    private static final String TENANT_ID = "tenant-1";
    private static final int TOTAL_DEFINITIONS =
            SystemScriptDefinition.values().length + SoftwareScriptDefinition.values().length;

    private final SeedManagedScriptsChangeUnit changeUnit = new SeedManagedScriptsChangeUnit();

    private ScriptRepository scriptRepository;
    private TenantIdProvider tenantIdProvider;

    @BeforeEach
    void setUp() {
        scriptRepository = mock(ScriptRepository.class);
        tenantIdProvider = mock(TenantIdProvider.class);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
    }

    @Test
    void seedsAllManagedScriptsWhenAbsent() {
        when(scriptRepository.findByTenantIdAndNameAndType(any(), any(), any())).thenReturn(Optional.empty());
        when(scriptRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        changeUnit.execution(scriptRepository, tenantIdProvider);

        ArgumentCaptor<Script> saved = ArgumentCaptor.forClass(Script.class);
        verify(scriptRepository, times(TOTAL_DEFINITIONS)).save(saved.capture());
        List<Script> scripts = saved.getAllValues();

        // --- SYSTEM (bootstrap) ---
        Script brew = byName(scripts, SystemScriptCode.INSTALL_BREW.canonicalName());
        assertEquals(TENANT_ID, brew.getTenantId());
        assertEquals(ScriptType.SYSTEM, brew.getType());
        assertEquals(ScriptShell.BASH, brew.getShell());
        assertEquals(PrivilegeLevel.ADMIN, brew.getPrivilegeLevel());
        assertEquals(ScriptStatus.ACTIVE, brew.getStatus());
        assertNotNull(brew.getContentHash());
        assertNotNull(brew.getDefaultTimeoutSeconds());

        Script winget = byName(scripts, SystemScriptCode.INSTALL_WINGET.canonicalName());
        assertEquals(ScriptType.SYSTEM, winget.getType());
        assertEquals(PrivilegeLevel.USER, winget.getPrivilegeLevel());

        // --- SOFTWARE (install/update) ---
        Script brewInstall = byName(scripts, SoftwareScriptCode.BREW_INSTALL.canonicalName());
        assertEquals(ScriptType.SOFTWARE, brewInstall.getType());
        assertEquals(ScriptShell.BASH, brewInstall.getShell());
        assertEquals(PrivilegeLevel.USER, brewInstall.getPrivilegeLevel());
        assertNotNull(brewInstall.getDefaultTimeoutSeconds());
        assertTrue(brewInstall.getScriptBody().contains("install \"$@\""));

        Script brewUpgrade = byName(scripts, SoftwareScriptCode.BREW_UPGRADE.canonicalName());
        assertEquals(ScriptType.SOFTWARE, brewUpgrade.getType());
        assertEquals(PrivilegeLevel.USER, brewUpgrade.getPrivilegeLevel());
        assertTrue(brewUpgrade.getScriptBody().contains("upgrade \"$@\""));
    }

    @Test
    void refreshesTheScriptWhenTheShippedBodyChanged() {
        Script stale = new Script();
        stale.setName(SystemScriptCode.INSTALL_BREW.canonicalName());
        stale.setType(ScriptType.SYSTEM);
        stale.setContentHash("stale-hash");
        when(scriptRepository.findByTenantIdAndNameAndType(any(), any(), any())).thenAnswer(inv ->
                SystemScriptCode.INSTALL_BREW.canonicalName().equals(inv.getArgument(1))
                        ? Optional.of(stale) : Optional.empty());
        when(scriptRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        changeUnit.execution(scriptRepository, tenantIdProvider);

        assertNotNull(stale.getScriptBody());
        assertNotNull(stale.getContentHash());
        assertTrue(!"stale-hash".equals(stale.getContentHash()));
    }

    @Test
    void leavesUpToDateScriptsUntouched() {
        when(scriptRepository.findByTenantIdAndNameAndType(any(), any(), any())).thenReturn(Optional.empty());
        when(scriptRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        changeUnit.execution(scriptRepository, tenantIdProvider);
        ArgumentCaptor<Script> seeded = ArgumentCaptor.forClass(Script.class);
        verify(scriptRepository, times(TOTAL_DEFINITIONS)).save(seeded.capture());

        ScriptRepository secondRepo = mock(ScriptRepository.class);
        for (Script script : seeded.getAllValues()) {
            when(secondRepo.findByTenantIdAndNameAndType(TENANT_ID, script.getName(), script.getType()))
                    .thenReturn(Optional.of(script));
        }

        changeUnit.execution(secondRepo, tenantIdProvider);

        verify(secondRepo, never()).save(any());
    }

    @Test
    void everyManagedScriptCodeHasExactlyOneSeedingDefinition() {
        for (SystemScriptCode code : SystemScriptCode.values()) {
            long definitions = Arrays.stream(SystemScriptDefinition.values())
                    .filter(d -> d.getCode() == code)
                    .count();
            assertEquals(1, definitions, "system code without exactly one seeding definition: " + code);
        }
        for (SoftwareScriptCode code : SoftwareScriptCode.values()) {
            long definitions = Arrays.stream(SoftwareScriptDefinition.values())
                    .filter(d -> d.getCode() == code)
                    .count();
            assertEquals(1, definitions, "software code without exactly one seeding definition: " + code);
        }
    }

    private static Script byName(List<Script> scripts, String name) {
        return scripts.stream()
                .filter(script -> name.equals(script.getName()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("script not seeded: " + name));
    }
}
