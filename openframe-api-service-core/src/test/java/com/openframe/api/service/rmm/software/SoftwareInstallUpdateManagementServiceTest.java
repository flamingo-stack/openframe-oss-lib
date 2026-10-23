package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.rmm.software.SoftwareDispatchResult;
import com.openframe.api.dto.rmm.software.SoftwareManagementInput;
import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.nats.packageupdate.PackageUpdateDispatchService;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.MachinePlatformResolver;
import com.openframe.data.service.rmm.software.BrewPackageManagerHandler;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.data.service.rmm.software.PackageManagerRegistry;
import com.openframe.data.service.rmm.software.PackageUpdateEligibilityService;
import com.openframe.data.service.rmm.software.WingetPackageManagerHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareInstallUpdateManagementServiceTest {

    private static final String USER = "user-1";
    private static final List<String> MACHINES = List.of("m1", "m2");

    private static final String TENANT = "t1";

    @Mock private PackageManagerRegistry registry;
    @Mock private ScriptService scriptService;
    @Mock private SoftwareDispatchService softwareDispatchService;
    @Mock private MachineRepository machineRepository;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private PackageUpdateEligibilityService packageUpdateEligibility;
    @Mock private PackageUpdateDispatchService packageUpdateDispatchService;

    private SoftwareInstallUpdateManagementService service;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        PackageManagerAvailability packageManagerAvailability =
                new PackageManagerAvailability(new PackageManagerProperties(), machineRepository, tenantIdProvider);
        MachinePlatformResolver platformResolver =
                new MachinePlatformResolver(machineRepository, tenantIdProvider, packageManagerAvailability);
        service = new SoftwareInstallUpdateManagementService(registry, scriptService, softwareDispatchService,
                platformResolver, packageUpdateEligibility, packageUpdateDispatchService);
        // A real brew handler so we exercise real script-code + arg building.
        when(registry.handlerFor(PackageManagerType.BREW)).thenReturn(new BrewPackageManagerHandler());
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
    }

    private void allMacTargets() {
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m1", OsType.MAC_OS), machine("m2", OsType.MAC_OS)));
    }

    @Test
    @DisplayName("install: each package dispatched with the right script + args; system script resolved once; one execution id per package")
    void install_dispatchesPerPackage() {
        allMacTargets();
        ScriptResponse installScript = systemScript("brew-install-id");
        when(scriptService.getSoftwareScript(SoftwareScriptCode.BREW_INSTALL)).thenReturn(installScript);

        SoftwareManagementInput input = input(
                pkg(PackageManagerType.BREW, "slack", BrewPackageType.CASK),
                pkg(PackageManagerType.BREW, "wireshark", BrewPackageType.FORMULA));

        List<SoftwareDispatchResult> results = service.install(input, USER, ExecutionSource.MANUAL);

        // System script resolved once for both brew packages (cached).
        verify(scriptService, times(1)).getSoftwareScript(SoftwareScriptCode.BREW_INSTALL);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> argsCaptor = ArgumentCaptor.forClass(List.class);
        verify(softwareDispatchService, times(2))
                .dispatch(any(), eq(installScript), eq(MACHINES), argsCaptor.capture(), eq(USER),
                        eq(ExecutionSource.MANUAL), eq(PackageManagerType.BREW), any(), eq(SoftwareAction.INSTALL));
        assertThat(argsCaptor.getAllValues().get(0)).containsExactly("--cask", "slack");
        assertThat(argsCaptor.getAllValues().get(1)).containsExactly("wireshark");

        assertThat(results).extracting(SoftwareDispatchResult::getPackageName)
                .containsExactly("slack", "wireshark");
        assertThat(results).extracting(SoftwareDispatchResult::getExecutionId)
                .doesNotContainNull().doesNotHaveDuplicates().hasSize(2);
        assertThat(results).allSatisfy(r ->
                assertThat(r.getPackageManager()).isEqualTo(PackageManagerType.BREW));
    }

    @Test
    @DisplayName("update: routes to the BREW_UPDATE system script and propagates the caller's ExecutionSource (e.g. AI_ASSISTANT for MingoAI)")
    void update_usesUpdateScript_andPropagatesSource() {
        allMacTargets();
        ScriptResponse updateScript = systemScript("brew-update-id");
        when(scriptService.getSoftwareScript(SoftwareScriptCode.BREW_UPDATE)).thenReturn(updateScript);

        service.update(input(pkg(PackageManagerType.BREW, "slack", BrewPackageType.CASK)), USER,
                ExecutionSource.AI_ASSISTANT);

        verify(scriptService).getSoftwareScript(SoftwareScriptCode.BREW_UPDATE);
        verify(softwareDispatchService).dispatch(any(), eq(updateScript), eq(MACHINES),
                eq(List.of("--cask", "slack")), eq(USER), eq(ExecutionSource.AI_ASSISTANT),
                eq(PackageManagerType.BREW), eq("slack"), eq(SoftwareAction.UPDATE));
        verifyNoInteractions(packageUpdateDispatchService);
    }

    @Test
    @DisplayName("install: a mixed brew+winget bundle routes each package to its own OS — brew→macOS, winget→Windows")
    void install_mixedOs_routesPerPackage() {
        when(registry.handlerFor(PackageManagerType.WINGET)).thenReturn(new WingetPackageManagerHandler());
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-mac", OsType.MAC_OS), machine("m-win", OsType.WINDOWS)));
        ScriptResponse brew = script("brew-install-id", OsType.MAC_OS);
        ScriptResponse winget = script("winget-install-id", OsType.WINDOWS);
        when(scriptService.getSoftwareScript(SoftwareScriptCode.BREW_INSTALL)).thenReturn(brew);
        when(scriptService.getSoftwareScript(SoftwareScriptCode.WINGET_INSTALL)).thenReturn(winget);

        SoftwareManagementInput mixed = new SoftwareManagementInput();
        mixed.setMachineIds(List.of("m-mac", "m-win"));
        mixed.setPackages(List.of(
                pkg(PackageManagerType.BREW, "slack", BrewPackageType.CASK),
                pkg(PackageManagerType.WINGET, "vscode", null)));

        service.install(mixed, USER, ExecutionSource.MANUAL);

        verify(softwareDispatchService).dispatch(any(), eq(brew), eq(List.of("m-mac")), anyList(), eq(USER),
                eq(ExecutionSource.MANUAL), eq(PackageManagerType.BREW), eq("slack"), eq(SoftwareAction.INSTALL));
        verify(softwareDispatchService).dispatch(any(), eq(winget), eq(List.of("m-win")), anyList(), eq(USER),
                eq(ExecutionSource.MANUAL), eq(PackageManagerType.WINGET), eq("vscode"), eq(SoftwareAction.INSTALL));
    }

    @Test
    @DisplayName("install: a package with no OS-compatible device is skipped, while a compatible one still dispatches")
    void install_incompatiblePackage_skipped() {
        when(registry.handlerFor(PackageManagerType.WINGET)).thenReturn(new WingetPackageManagerHandler());
        // Only a macOS device is assigned — the winget package has nowhere to go.
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-mac", OsType.MAC_OS)));
        ScriptResponse brew = script("brew-install-id", OsType.MAC_OS);
        ScriptResponse winget = script("winget-install-id", OsType.WINDOWS);
        when(scriptService.getSoftwareScript(SoftwareScriptCode.BREW_INSTALL)).thenReturn(brew);
        when(scriptService.getSoftwareScript(SoftwareScriptCode.WINGET_INSTALL)).thenReturn(winget);

        SoftwareManagementInput in = new SoftwareManagementInput();
        in.setMachineIds(List.of("m-mac"));
        in.setPackages(List.of(
                pkg(PackageManagerType.BREW, "slack", BrewPackageType.CASK),
                pkg(PackageManagerType.WINGET, "vscode", null)));

        List<SoftwareDispatchResult> results = service.install(in, USER, ExecutionSource.MANUAL);

        assertThat(results).extracting(SoftwareDispatchResult::getPackageName).containsExactly("slack");
        verify(softwareDispatchService).dispatch(any(), eq(brew), eq(List.of("m-mac")), anyList(), eq(USER),
                eq(ExecutionSource.MANUAL), eq(PackageManagerType.BREW), eq("slack"), eq(SoftwareAction.INSTALL));
        verify(softwareDispatchService, never()).dispatch(any(), eq(winget), anyList(), anyList(), any(), any(),
                any(), any(), any());
    }

    @Test
    @DisplayName("update: feature-enabled devices take the order path, the rest the script path, under one shared execution id")
    void update_mixedFleet_splitsTargets_sharedExecutionId() {
        allMacTargets();
        ScriptResponse updateScript = systemScript("brew-update-id");
        when(scriptService.getSoftwareScript(SoftwareScriptCode.BREW_UPDATE)).thenReturn(updateScript);
        when(packageUpdateEligibility.eligibleMachines(SoftwareAction.UPDATE, MACHINES))
                .thenReturn(Set.of("m1"));   // m1 order, m2 legacy

        service.update(input(pkg(PackageManagerType.BREW, "slack", BrewPackageType.CASK)), USER, ExecutionSource.MANUAL);

        ArgumentCaptor<String> scriptExec = ArgumentCaptor.forClass(String.class);
        verify(softwareDispatchService).dispatch(scriptExec.capture(), eq(updateScript), eq(List.of("m2")),
                anyList(), eq(USER), eq(ExecutionSource.MANUAL), eq(PackageManagerType.BREW), eq("slack"),
                eq(SoftwareAction.UPDATE));

        ArgumentCaptor<String> orderExec = ArgumentCaptor.forClass(String.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> orderTargets = ArgumentCaptor.forClass(List.class);
        verify(packageUpdateDispatchService).dispatchAdminUpdateNow(orderExec.capture(), eq(PackageManagerType.BREW),
                eq("slack"), eq(BrewPackageType.CASK), orderTargets.capture(), eq(USER));

        assertThat(orderExec.getValue()).isEqualTo(scriptExec.getValue());   // one row on the screen
        assertThat(orderTargets.getValue()).containsExactly("m1");
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
        p.setPackageName(id);
        p.setBrewPackageType(type);
        return p;
    }

    private static ScriptResponse systemScript(String id) {
        return script(id, OsType.MAC_OS);
    }

    private static ScriptResponse script(String id, OsType supported) {
        return ScriptResponse.builder()
                .id(id)
                .privilegeLevel(PrivilegeLevel.ADMIN)
                .defaultTimeoutSeconds(600)
                .supportedPlatforms(List.of(supported))
                .build();
    }

    private static Machine machine(String machineId, OsType osType) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setOsType(osType);
        return m;
    }
}
