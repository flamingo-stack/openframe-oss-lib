package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.rmm.software.SoftwareManagementInput;
import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.service.rmm.MachinePlatformResolver;
import com.openframe.data.service.rmm.software.PackageManagerHandler;
import com.openframe.data.service.rmm.software.PackageManagerRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareInstallUpdateManagementServiceTest {

    @Mock private PackageManagerRegistry packageManagerRegistry;
    @Mock private ScriptService scriptService;
    @Mock private SoftwareDispatchService softwareDispatchService;
    @Mock private MachinePlatformResolver machinePlatformResolver;
    @Mock private PackageUpdateEligibilityService packageUpdateEligibility;
    @Mock private PackageUpdateDispatchService packageUpdateDispatchService;

    @InjectMocks private SoftwareInstallUpdateManagementService service;

    @Mock private PackageManagerHandler handler;
    @Mock private ScriptResponse script;

    private static final SoftwareScriptCode CODE = SoftwareScriptCode.values()[0];

    private SoftwareManagementInput input(SoftwarePackageInput pkg, String... machineIds) {
        SoftwareManagementInput in = new SoftwareManagementInput();
        in.setMachineIds(List.of(machineIds));
        in.setPackages(List.of(pkg));
        return in;
    }

    private SoftwarePackageInput winget(String name) {
        SoftwarePackageInput p = new SoftwarePackageInput();
        p.setPackageManager(PackageManagerType.WINGET);
        p.setPackageName(name);
        return p;
    }

    private void wirePipeline(List<String> targets) {
        when(packageManagerRegistry.handlerFor(PackageManagerType.WINGET)).thenReturn(handler);
        when(handler.scriptCode(any())).thenReturn(CODE);
        when(scriptService.getSoftwareScript(CODE)).thenReturn(script);
        when(machinePlatformResolver.osTypesByMachineId(any())).thenReturn(Map.<String, OsType>of());
        when(script.getSupportedPlatforms()).thenReturn(List.of());
        when(machinePlatformResolver.compatible(any(), any(), any())).thenReturn(targets);
        when(handler.buildArgs(any(), any())).thenReturn(List.of("--arg"));
    }

    @Test
    void mixedFleet_splitsTargets_andSharesOneExecutionId() {
        SoftwarePackageInput pkg = winget("Google.Chrome");
        wirePipeline(List.of("m1", "m2", "m3"));
        when(packageUpdateEligibility.eligibleMachines(List.of("m1", "m2", "m3"))).thenReturn(Set.of("m1", "m2"));

        service.update(input(pkg, "m1", "m2", "m3"), "admin", ExecutionSource.MANUAL);

        ArgumentCaptor<String> scriptExecId = ArgumentCaptor.forClass(String.class);
        verify(softwareDispatchService).dispatch(scriptExecId.capture(), eq(script), eq(List.of("m3")),
                eq(List.of("--arg")), eq("admin"), eq(ExecutionSource.MANUAL),
                eq(PackageManagerType.WINGET), eq("Google.Chrome"), eq(SoftwareAction.UPDATE));

        ArgumentCaptor<String> orderExecId = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<List<String>> orderTargets = ArgumentCaptor.forClass(List.class);
        verify(packageUpdateDispatchService).dispatchAdminUpdateNow(orderExecId.capture(),
                eq(SoftwareAction.UPDATE), eq(pkg), orderTargets.capture(), eq("admin"));

        assertThat(orderExecId.getValue()).isEqualTo(scriptExecId.getValue());   // one row on the screen
        assertThat(orderTargets.getValue()).containsExactlyInAnyOrder("m1", "m2");
    }

    @Test
    void allLegacyClients_onlyScriptPath_noOrder() {
        SoftwarePackageInput pkg = winget("Google.Chrome");
        wirePipeline(List.of("m1", "m2"));
        when(packageUpdateEligibility.eligibleMachines(List.of("m1", "m2"))).thenReturn(Set.of());

        service.update(input(pkg, "m1", "m2"), "admin", ExecutionSource.MANUAL);

        verify(softwareDispatchService).dispatch(any(), eq(script), eq(List.of("m1", "m2")),
                anyList(), eq("admin"), eq(ExecutionSource.MANUAL),
                eq(PackageManagerType.WINGET), eq("Google.Chrome"), eq(SoftwareAction.UPDATE));
        verifyNoInteractions(packageUpdateDispatchService);
    }

    @Test
    void allEligibleClients_onlyOrderPath_noScript() {
        SoftwarePackageInput pkg = winget("Google.Chrome");
        wirePipeline(List.of("m1", "m2"));
        when(packageUpdateEligibility.eligibleMachines(List.of("m1", "m2"))).thenReturn(Set.of("m1", "m2"));

        service.update(input(pkg, "m1", "m2"), "admin", ExecutionSource.MANUAL);

        verify(packageUpdateDispatchService).dispatchAdminUpdateNow(any(), eq(SoftwareAction.UPDATE),
                eq(pkg), anyList(), eq("admin"));
        verify(softwareDispatchService, never()).dispatch(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }
}
