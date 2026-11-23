package com.openframe.client.service;

import com.openframe.client.service.rmm.ScriptDeliveryRetryStore;
import com.openframe.client.service.rmm.SoftwareScheduleFireDispatcher;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.chocolatey.ChocolateyStatus;
import com.openframe.data.document.device.chocolatey.MachineChocolatey;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareSchedulePackage;
import com.openframe.data.document.rmm.script.DeliveryChannel;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptType;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdate;
import com.openframe.data.document.rmm.software.SoftwareExecutionId;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.nats.packageupdate.PackageUpdateDispatchService;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.SoftwareNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.MachinePlatformResolver;
import com.openframe.data.service.rmm.software.BrewPackageManagerHandler;
import com.openframe.data.service.rmm.software.ChocoPackageManagerHandler;
import com.openframe.data.service.rmm.software.ChocoPackageOwnership;
import com.openframe.data.service.rmm.software.PackageAutoUpdatePolicyService;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.data.service.rmm.software.PackageManagerRegistry;
import com.openframe.data.nats.packageupdate.PackageUpdateEligibilityService;
import com.openframe.data.service.rmm.software.WingetPackageManagerHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SoftwareScheduleFireDispatcherTest {

    private static final String TENANT = "t-1";
    private static final String CHOCO_FEED_URL = "https://feed.openframe.test/choco/index.json";
    private static final String CHOCO_PACKAGE = "googlechrome";

    private final ScriptRepository scriptRepository = mock(ScriptRepository.class);
    private final PackageManagerProperties packageManagerProperties = chocoProperties();
    private final PackageManagerRegistry registry = new PackageManagerRegistry(
            List.of(new BrewPackageManagerHandler(), new WingetPackageManagerHandler(),
                    new ChocoPackageManagerHandler(packageManagerProperties)),
            packageManagerProperties);
    private final ScriptExecutionRepository scriptExecutionRepository = mock(ScriptExecutionRepository.class);
    private final SoftwareNatsPublisher softwareNatsPublisher = mock(SoftwareNatsPublisher.class);
    private final ScriptDeliveryRetryStore retryStore = mock(ScriptDeliveryRetryStore.class);
    private final MachineRepository machineRepository = mock(MachineRepository.class);
    private final TenantIdProvider tenantIdProvider = mock(TenantIdProvider.class);
    private final PackageManagerAvailability packageManagerAvailability =
            new PackageManagerAvailability(packageManagerProperties, machineRepository, tenantIdProvider);
    private final MachinePlatformResolver platformResolver =
            new MachinePlatformResolver(machineRepository, tenantIdProvider, packageManagerAvailability);

    private final PackageUpdateEligibilityService packageUpdateEligibility = mock(PackageUpdateEligibilityService.class);
    private final PackageUpdateDispatchService packageUpdateDispatchService = mock(PackageUpdateDispatchService.class);

    private final PackageAutoUpdatePolicyService autoUpdatePolicyService = mock(PackageAutoUpdatePolicyService.class);
    private final ChocoPackageOwnership chocoPackageOwnership = mock(ChocoPackageOwnership.class);

    private final ArgumentCaptor<RunningExecutionRows> rowsCaptor = ArgumentCaptor.forClass(RunningExecutionRows.class);
    private final ArgumentCaptor<ScriptMessage> messageCaptor = ArgumentCaptor.forClass(ScriptMessage.class);

    private final SoftwareScheduleFireDispatcher dispatcher = new SoftwareScheduleFireDispatcher(
            scriptRepository, registry, scriptExecutionRepository, softwareNatsPublisher, retryStore, platformResolver,
            packageUpdateEligibility, packageUpdateDispatchService, autoUpdatePolicyService, chocoPackageOwnership);

    @Test
    @DisplayName("fires a brew install to its macOS targets: QUEUED rows, one software-pipe message per machine, each armed for SOFTWARE-channel retry")
    void dispatch_fansOutQueuedSoftware() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-1", OsType.MAC_OS), machine("m-2", OsType.MAC_OS)));
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__brew-install", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(brewScript()));

        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).createdBy("user-1").action(SoftwareAction.INSTALL)
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.BREW).packageName("slack").brewPackageType(BrewPackageType.CASK)
                        .build()))
                .build();

        dispatcher.dispatch(schedule, List.of("m-1", "m-2"), Instant.now());

        ArgumentCaptor<RunningExecutionRows> rows = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(scriptExecutionRepository).saveQueued(rows.capture());
        RunningExecutionRows req = rows.getValue();
        assertThat(req.getMachineIds()).containsExactly("m-1", "m-2");
        assertThat(req.getSource()).isEqualTo(ExecutionSource.SCHEDULED);
        assertThat(req.getPackageName()).isEqualTo("slack");
        String executionId = req.getExecutionId();

        ArgumentCaptor<ScriptMessage> msgs = ArgumentCaptor.forClass(ScriptMessage.class);
        verify(softwareNatsPublisher, times(2)).publishSoftware(any(), msgs.capture());
        assertThat(msgs.getAllValues()).allSatisfy(m -> assertThat(m.getArgs()).containsExactly("--cask", "slack"));
        verify(retryStore).store(eq(executionId), eq("m-1"), eq(DeliveryChannel.SOFTWARE), any());
        verify(retryStore).store(eq(executionId), eq("m-2"), eq(DeliveryChannel.SOFTWARE), any());
    }

    @Test
    @DisplayName("a winget package skips the Windows device that cannot run winget, even though Chocolatey manages that device")
    void dispatch_deviceThatCannotRunTheManager_isNotATarget() {
        packageManagerProperties.setChocoEnabled(true);
        Machine server = machine("m-server", OsType.WINDOWS);
        server.setPackageManagers(Map.of(PackageManagerType.WINGET, PackageManagerState.UNSUPPORTED,
                PackageManagerType.CHOCO, PackageManagerState.PRESENT));
        server.setChocolatey(MachineChocolatey.builder().status(ChocolateyStatus.MANAGED).build());
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-win", OsType.WINDOWS), server));
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__winget-install", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(script("winget-install-id", OsType.WINDOWS)));
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).createdBy("user-1").action(SoftwareAction.INSTALL)
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.WINGET).packageName("vscode").build()))
                .build();

        dispatcher.dispatch(schedule, List.of("m-win", "m-server"), Instant.now());

        ArgumentCaptor<RunningExecutionRows> rows = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(scriptExecutionRepository).saveQueued(rows.capture());
        assertThat(rows.getValue().getMachineIds()).containsExactly("m-win");
        verify(softwareNatsPublisher, never()).publishSoftware(eq("m-server"), any());
    }

    @Test
    @DisplayName("mixed brew+winget schedule routes each package to its own OS — brew→macOS, winget→Windows")
    void dispatch_mixedOs_routesPerPackage() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-mac", OsType.MAC_OS), machine("m-win", OsType.WINDOWS)));
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__brew-install", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(script("brew-install-id", OsType.MAC_OS)));
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__winget-install", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(script("winget-install-id", OsType.WINDOWS)));

        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).createdBy("user-1").action(SoftwareAction.INSTALL)
                .packages(List.of(
                        SoftwareSchedulePackage.builder().packageManager(PackageManagerType.BREW).packageName("slack").brewPackageType(BrewPackageType.CASK).build(),
                        SoftwareSchedulePackage.builder().packageManager(PackageManagerType.WINGET).packageName("vscode").build()))
                .build();

        dispatcher.dispatch(schedule, List.of("m-mac", "m-win"), Instant.now());

        ArgumentCaptor<RunningExecutionRows> rows = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(scriptExecutionRepository, times(2)).saveQueued(rows.capture());
        RunningExecutionRows brew = rowFor(rows.getAllValues(), "slack");
        RunningExecutionRows winget = rowFor(rows.getAllValues(), "vscode");
        assertThat(brew.getMachineIds()).containsExactly("m-mac");   // brew only to macOS
        assertThat(winget.getMachineIds()).containsExactly("m-win"); // winget only to Windows

        verify(softwareNatsPublisher).publishSoftware(eq("m-mac"), any());
        verify(softwareNatsPublisher).publishSoftware(eq("m-win"), any());
    }

    @Test
    @DisplayName("update: feature-enabled devices get a package-update order with the schedule's update settings, the rest the script, under the schedule's execution id")
    void dispatch_update_splitsOrderAndScriptTargets() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-1", OsType.MAC_OS), machine("m-2", OsType.MAC_OS)));
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__brew-update", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(script("brew-update-id", OsType.MAC_OS)));
        when(packageUpdateEligibility.eligibleMachines(SoftwareAction.UPDATE, List.of("m-1", "m-2")))
                .thenReturn(Set.of("m-1"));
        PackageUpdateSettings settings = PackageUpdateSettings.builder()
                .mode(PackageUpdateMode.FORCE).countdownSeconds(120).build();
        SoftwareAutoUpdate autoUpdate = SoftwareAutoUpdate.builder().enabled(true).build();

        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).createdBy("user-1").action(SoftwareAction.UPDATE)
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.BREW).packageName("slack").brewPackageType(BrewPackageType.CASK)
                        .softwareId("title-7")
                        .build()))
                .updateSettings(settings)
                .autoUpdate(autoUpdate)
                .build();

        dispatcher.dispatch(schedule, List.of("m-1", "m-2"), Instant.now());

        String executionId = SoftwareExecutionId.forSchedule("ss-1", PackageManagerType.BREW, "slack");
        ArgumentCaptor<RunningExecutionRows> order = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(packageUpdateDispatchService).dispatchAdminUpdate(order.capture(), eq(BrewPackageType.CASK), eq(settings));
        // auto-update only where the order goes: the script path cannot run it
        ArgumentCaptor<RunningExecutionRows> autoUpdateRows = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(autoUpdatePolicyService).turnOn(autoUpdateRows.capture(), eq(BrewPackageType.CASK), eq("title-7"),
                eq(autoUpdate), eq(settings));
        assertThat(autoUpdateRows.getValue().getMachineIds()).containsExactly("m-1");
        assertThat(order.getValue().getExecutionId()).isEqualTo(executionId);
        assertThat(order.getValue().getMachineIds()).containsExactly("m-1");
        assertThat(order.getValue().getScriptId()).isEqualTo("brew-update-id");
        assertThat(order.getValue().getSource()).isEqualTo(ExecutionSource.SCHEDULED);
        assertThat(order.getValue().getSoftwareScheduleId()).isEqualTo("ss-1");
        assertThat(order.getValue().getInitiatedBy()).isEqualTo("user-1");

        ArgumentCaptor<RunningExecutionRows> rows = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(scriptExecutionRepository).saveQueued(rows.capture());
        assertThat(rows.getValue().getExecutionId()).isEqualTo(executionId);
        assertThat(rows.getValue().getMachineIds()).containsExactly("m-2");
        verify(softwareNatsPublisher).publishSoftware(eq("m-2"), any());
        verify(softwareNatsPublisher, never()).publishSoftware(eq("m-1"), any());
    }

    @Test
    @DisplayName("update: every device feature-enabled → orders only, no script rows")
    void dispatch_update_allEligible_noScript() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-1", OsType.MAC_OS)));
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__brew-update", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(script("brew-update-id", OsType.MAC_OS)));
        when(packageUpdateEligibility.eligibleMachines(SoftwareAction.UPDATE, List.of("m-1"))).thenReturn(Set.of("m-1"));

        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).createdBy("user-1").action(SoftwareAction.UPDATE)
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.BREW).packageName("slack").brewPackageType(BrewPackageType.CASK)
                        .build()))
                .build();

        dispatcher.dispatch(schedule, List.of("m-1"), Instant.now());

        ArgumentCaptor<RunningExecutionRows> order = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(packageUpdateDispatchService).dispatchAdminUpdate(order.capture(), eq(BrewPackageType.CASK), any());
        assertThat(order.getValue().getMachineIds()).containsExactly("m-1");
        verify(scriptExecutionRepository, never()).saveQueued(any());
        verify(softwareNatsPublisher, never()).publishSoftware(any(), any());
    }

    @Test
    @DisplayName("no target machines → nothing dispatched")
    void dispatch_noMachines_noop() {
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).action(SoftwareAction.INSTALL)
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.BREW).packageName("slack").brewPackageType(BrewPackageType.CASK).build()))
                .build();

        dispatcher.dispatch(schedule, List.of(), Instant.now());

        verify(scriptExecutionRepository, times(0)).saveQueued(any());
        verify(softwareNatsPublisher, times(0)).publishSoftware(any(), any());
    }

    @Test
    void dispatch_chocoUpdate_scriptGoesOnlyToOwningDevices() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        stubChocoManagedMachines("m-1", "m-2");
        stubChocoScript(SoftwareScriptCode.CHOCO_UPDATE, "choco-update-id");
        when(chocoPackageOwnership.owners(List.of("m-1", "m-2"), CHOCO_PACKAGE)).thenReturn(List.of("m-2"));

        // execution
        dispatcher.dispatch(chocoSchedule(SoftwareAction.UPDATE), List.of("m-1", "m-2"), Instant.now());

        // verifications
        verify(scriptExecutionRepository).saveQueued(rowsCaptor.capture());
        assertThat(rowsCaptor.getValue().getMachineIds()).containsExactly("m-2");
        verify(softwareNatsPublisher).publishSoftware(eq("m-2"), messageCaptor.capture());
        assertThat(messageCaptor.getValue().getArgs()).containsExactly(CHOCO_PACKAGE, CHOCO_FEED_URL);
        verify(softwareNatsPublisher, never()).publishSoftware(eq("m-1"), any(ScriptMessage.class));
    }

    @Test
    void dispatch_chocoUpdateOnFeatureEnabledDevices_orderGoesOnlyToOwningDevices() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        stubChocoManagedMachines("m-1", "m-2");
        stubChocoScript(SoftwareScriptCode.CHOCO_UPDATE, "choco-update-id");
        when(packageUpdateEligibility.eligibleMachines(SoftwareAction.UPDATE, List.of("m-1", "m-2")))
                .thenReturn(Set.of("m-1", "m-2"));
        when(chocoPackageOwnership.owners(List.of("m-1", "m-2"), CHOCO_PACKAGE)).thenReturn(List.of("m-1"));

        // execution
        dispatcher.dispatch(chocoSchedule(SoftwareAction.UPDATE), List.of("m-1", "m-2"), Instant.now());

        // verifications
        verify(packageUpdateDispatchService).dispatchAdminUpdate(rowsCaptor.capture(), isNull(), isNull());
        assertThat(rowsCaptor.getValue())
                .returns(List.of("m-1"), RunningExecutionRows::getMachineIds)
                .returns(PackageManagerType.CHOCO, RunningExecutionRows::getPackageManager)
                .returns(CHOCO_PACKAGE, RunningExecutionRows::getPackageName);
        verify(scriptExecutionRepository, never()).saveQueued(any(RunningExecutionRows.class));
        verifyNoInteractions(softwareNatsPublisher);
    }

    @Test
    void dispatch_chocoUpdateNoOwningDevice_nothingDispatched() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        stubChocoManagedMachines("m-1", "m-2");
        stubChocoScript(SoftwareScriptCode.CHOCO_UPDATE, "choco-update-id");
        when(packageUpdateEligibility.eligibleMachines(SoftwareAction.UPDATE, List.of("m-1", "m-2")))
                .thenReturn(Set.of("m-1"));
        when(chocoPackageOwnership.owners(List.of("m-1", "m-2"), CHOCO_PACKAGE)).thenReturn(List.of());

        // execution
        dispatcher.dispatch(chocoSchedule(SoftwareAction.UPDATE), List.of("m-1", "m-2"), Instant.now());

        // verifications
        verifyNoInteractions(packageUpdateDispatchService, autoUpdatePolicyService, scriptExecutionRepository,
                softwareNatsPublisher, retryStore);
    }

    @Test
    void dispatch_chocoInstall_goesToEveryUsableDeviceWithoutConsultingOwnership() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        stubChocoManagedMachines("m-1", "m-2");
        stubChocoScript(SoftwareScriptCode.CHOCO_INSTALL, "choco-install-id");

        // execution
        dispatcher.dispatch(chocoSchedule(SoftwareAction.INSTALL), List.of("m-1", "m-2"), Instant.now());

        // verifications
        verify(scriptExecutionRepository).saveQueued(rowsCaptor.capture());
        assertThat(rowsCaptor.getValue().getMachineIds()).containsExactly("m-1", "m-2");
        verifyNoInteractions(chocoPackageOwnership);
    }

    @Test
    void dispatch_wingetUpdate_targetsNotNarrowedByChocoOwnership() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), anyCollection()))
                .thenReturn(List.of(machine("m-1", OsType.WINDOWS), machine("m-2", OsType.WINDOWS)));
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__winget-update", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(script("winget-update-id", OsType.WINDOWS)));
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).createdBy("user-1").action(SoftwareAction.UPDATE)
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.WINGET).packageName("Google.Chrome").build()))
                .build();

        // execution
        dispatcher.dispatch(schedule, List.of("m-1", "m-2"), Instant.now());

        // verifications
        verify(scriptExecutionRepository).saveQueued(rowsCaptor.capture());
        assertThat(rowsCaptor.getValue().getMachineIds()).containsExactly("m-1", "m-2");
        verifyNoInteractions(chocoPackageOwnership);
    }

    private void stubChocoManagedMachines(String firstMachineId, String secondMachineId) {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), anyCollection()))
                .thenReturn(List.of(chocoManagedMachine(firstMachineId), chocoManagedMachine(secondMachineId)));
    }

    private void stubChocoScript(SoftwareScriptCode code, String scriptId) {
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, code.canonicalName(), ScriptType.SOFTWARE))
                .thenReturn(Optional.of(script(scriptId, OsType.WINDOWS)));
    }

    private static PackageManagerProperties chocoProperties() {
        PackageManagerProperties properties = new PackageManagerProperties();
        properties.getChoco().setFeedUrl(CHOCO_FEED_URL);
        properties.getChoco().setVersion("2.7.5");
        properties.getChoco().setSha256("f86f99a1");
        return properties;
    }

    private static SoftwareSchedule chocoSchedule(SoftwareAction action) {
        return SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).createdBy("user-1").action(action)
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.CHOCO).packageName(CHOCO_PACKAGE).build()))
                .build();
    }

    private static Machine chocoManagedMachine(String machineId) {
        Machine machine = machine(machineId, OsType.WINDOWS);
        machine.setPackageManagers(Map.of(PackageManagerType.CHOCO, PackageManagerState.PRESENT));
        machine.setChocolatey(MachineChocolatey.builder().status(ChocolateyStatus.MANAGED).build());
        return machine;
    }

    private static RunningExecutionRows rowFor(List<RunningExecutionRows> rows, String packageName) {
        return rows.stream().filter(r -> packageName.equals(r.getPackageName())).findFirst().orElseThrow();
    }

    private static Script brewScript() {
        return script("brew-install-id", OsType.MAC_OS);
    }

    private static Script script(String id, OsType supported) {
        return Script.builder()
                .id(id).type(ScriptType.SOFTWARE)
                .scriptBody("run \"$@\"").shell(ScriptShell.BASH)
                .privilegeLevel(PrivilegeLevel.USER).defaultTimeoutSeconds(1800)
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
