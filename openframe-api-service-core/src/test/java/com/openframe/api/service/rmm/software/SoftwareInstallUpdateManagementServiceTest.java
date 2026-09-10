package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.rmm.software.SoftwareDispatchResult;
import com.openframe.api.dto.rmm.software.SoftwareManagementInput;
import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareInstallUpdateManagementServiceTest {

    private static final String USER = "user-1";
    private static final List<String> MACHINES = List.of("m1", "m2");

    @Mock private PackageManagerRegistry registry;
    @Mock private ScriptService scriptService;
    @Mock private SoftwareDispatchService softwareDispatchService;

    private SoftwareInstallUpdateManagementService service;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        service = new SoftwareInstallUpdateManagementService(registry, scriptService, softwareDispatchService);
        // A real brew handler so we exercise real script-code + arg building.
        when(registry.handlerFor(PackageManagerType.BREW)).thenReturn(new BrewPackageManagerHandler());
    }

    @Test
    @DisplayName("install: each package dispatched with the right script + args; system script resolved once")
    void install_dispatchesPerPackage() {
        ScriptResponse installScript = systemScript("brew-install-id");
        when(scriptService.getSoftwareScript(SoftwareScriptCode.BREW_INSTALL)).thenReturn(installScript);
        when(softwareDispatchService.dispatch(any(), anyList(), anyList(), eq(USER), eq(ExecutionSource.MANUAL)))
                .thenReturn("exec-slack", "exec-wireshark");

        SoftwareManagementInput input = input(
                pkg(PackageManagerType.BREW, "slack", BrewPackageType.CASK),
                pkg(PackageManagerType.BREW, "wireshark", BrewPackageType.FORMULA));

        List<SoftwareDispatchResult> results = service.install(input, USER);

        // System script resolved once for both brew packages (cached).
        verify(scriptService, times(1)).getSoftwareScript(SoftwareScriptCode.BREW_INSTALL);

        // Two dispatches, with cask/formula-correct args.
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> argsCaptor = ArgumentCaptor.forClass(List.class);
        verify(softwareDispatchService, times(2))
                .dispatch(eq(installScript), eq(MACHINES), argsCaptor.capture(), eq(USER), eq(ExecutionSource.MANUAL));
        assertThat(argsCaptor.getAllValues().get(0)).containsExactly("--cask", "slack");
        assertThat(argsCaptor.getAllValues().get(1)).containsExactly("wireshark");

        assertThat(results).extracting(SoftwareDispatchResult::getPackageId)
                .containsExactly("slack", "wireshark");
        assertThat(results).extracting(SoftwareDispatchResult::getExecutionId)
                .containsExactly("exec-slack", "exec-wireshark");
        assertThat(results).allSatisfy(r ->
                assertThat(r.getPackageManager()).isEqualTo(PackageManagerType.BREW));
    }

    @Test
    @DisplayName("update: routes to the BREW_UPDATE system script")
    void update_usesUpdateScript() {
        ScriptResponse updateScript = systemScript("brew-update-id");
        when(scriptService.getSoftwareScript(SoftwareScriptCode.BREW_UPDATE)).thenReturn(updateScript);
        when(softwareDispatchService.dispatch(any(), anyList(), anyList(), eq(USER), eq(ExecutionSource.MANUAL)))
                .thenReturn("exec-1");

        service.update(input(pkg(PackageManagerType.BREW, "slack", BrewPackageType.CASK)), USER);

        verify(scriptService).getSoftwareScript(SoftwareScriptCode.BREW_UPDATE);
        verify(softwareDispatchService).dispatch(eq(updateScript), eq(MACHINES),
                eq(List.of("--cask", "slack")), eq(USER), eq(ExecutionSource.MANUAL));
    }

    private static SoftwareManagementInput input(SoftwarePackageInput... packages) {
        SoftwareManagementInput input = new SoftwareManagementInput();
        input.setMachineIds(MACHINES);
        input.setPackages(List.of(packages));
        return input;
    }

    private static SoftwarePackageInput pkg(PackageManagerType manager, String id, BrewPackageType type) {
        SoftwarePackageInput p = new SoftwarePackageInput();
        p.setPackageManager(manager);
        p.setPackageId(id);
        p.setPackageType(type);
        return p;
    }

    private static ScriptResponse systemScript(String id) {
        return ScriptResponse.builder()
                .id(id)
                .privilegeLevel(PrivilegeLevel.ADMIN)
                .defaultTimeoutSeconds(600)
                .build();
    }
}
