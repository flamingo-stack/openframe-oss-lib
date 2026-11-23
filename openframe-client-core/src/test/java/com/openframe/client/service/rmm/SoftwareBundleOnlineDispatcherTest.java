package com.openframe.client.service.rmm;

import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.chocolatey.ChocolateyStatus;
import com.openframe.data.document.device.chocolatey.MachineChocolatey;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
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
import com.openframe.data.document.rmm.software.SoftwareBundle;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.document.rmm.software.SoftwareExecutionId;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.nats.packageupdate.PackageUpdateDispatchService;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.SoftwareNatsPublisher;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.rmm.software.BrewPackageManagerHandler;
import com.openframe.data.service.rmm.software.ChocoPackageManagerHandler;
import com.openframe.data.service.rmm.software.ChocoPackageOwnership;
import com.openframe.data.service.rmm.software.PackageAutoUpdatePolicyService;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.data.service.rmm.software.PackageManagerRegistry;
import com.openframe.data.nats.packageupdate.PackageUpdateEligibilityService;
import com.openframe.data.service.rmm.software.WingetPackageManagerHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SoftwareBundleOnlineDispatcherTest {

    private static final String TENANT = "t-1";
    private static final String CHOCO_FEED_URL = "https://feed.openframe.test/choco/index.json";
    private static final String CHOCO_PACKAGE = "googlechrome";

    private final ScriptRepository scriptRepository = mock(ScriptRepository.class);
    private final PackageManagerProperties packageManagerProperties = chocoEnabledProperties();
    private final PackageManagerRegistry registry = new PackageManagerRegistry(
            List.of(new BrewPackageManagerHandler(), new WingetPackageManagerHandler(),
                    new ChocoPackageManagerHandler(packageManagerProperties)),
            packageManagerProperties);
    private final ScriptExecutionRepository scriptExecutionRepository = mock(ScriptExecutionRepository.class);
    private final SoftwareNatsPublisher softwareNatsPublisher = mock(SoftwareNatsPublisher.class);
    private final ScriptDeliveryRetryStore retryStore = mock(ScriptDeliveryRetryStore.class);
    private final PackageManagerAvailability packageManagerAvailability = mock(PackageManagerAvailability.class);
    private final PackageUpdateEligibilityService packageUpdateEligibility = mock(PackageUpdateEligibilityService.class);
    private final PackageUpdateDispatchService packageUpdateDispatchService = mock(PackageUpdateDispatchService.class);

    private final PackageAutoUpdatePolicyService autoUpdatePolicyService = mock(PackageAutoUpdatePolicyService.class);
    private final ChocoPackageOwnership chocoPackageOwnership = mock(ChocoPackageOwnership.class);

    private final ArgumentCaptor<RunningExecutionRows> rowsCaptor = ArgumentCaptor.forClass(RunningExecutionRows.class);
    private final ArgumentCaptor<ScriptMessage> messageCaptor = ArgumentCaptor.forClass(ScriptMessage.class);

    private final SoftwareBundleOnlineDispatcher dispatcher = new SoftwareBundleOnlineDispatcher(
            scriptRepository, registry, scriptExecutionRepository, softwareNatsPublisher, retryStore,
            packageManagerAvailability, packageUpdateEligibility, packageUpdateDispatchService, autoUpdatePolicyService,
            chocoPackageOwnership);

    private final Machine mac = machine("m-1", OsType.MAC_OS);
    private final Machine win = chocoManagedMachine("m-win");

    @BeforeEach
    void setUp() {
        when(packageManagerAvailability.isSoftwareManageable(mac)).thenReturn(true);
    }

    @Test
    @DisplayName("update on a feature-enabled device: a package-update order under the bundle's execution id and with its update settings, no script")
    void update_eligibleDevice_sendsOrder() {
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__brew-update", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(script("brew-update-id")));
        when(packageUpdateEligibility.isEligible(SoftwareAction.UPDATE, mac)).thenReturn(true);
        PackageUpdateSettings settings = PackageUpdateSettings.builder()
                .mode(PackageUpdateMode.WAIT).deadlineSeconds(86_400L).countdownSeconds(600).build();
        SoftwareBundle bundle = bundle(SoftwareAction.UPDATE);
        bundle.setUpdateSettings(settings);

        dispatcher.dispatch(bundle, mac);

        ArgumentCaptor<RunningExecutionRows> order = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(packageUpdateDispatchService).dispatchAdminUpdate(order.capture(), eq(BrewPackageType.CASK), eq(settings));
        RunningExecutionRows rows = order.getValue();
        assertThat(rows.getExecutionId()).isEqualTo(SoftwareExecutionId.forBundle("b-1", PackageManagerType.BREW, "slack"));
        assertThat(rows.getMachineIds()).containsExactly("m-1");
        assertThat(rows.getScriptId()).isEqualTo("brew-update-id");
        assertThat(rows.getSoftwareBundleId()).isEqualTo("b-1");
        assertThat(rows.getInitiatedBy()).isEqualTo("user-1");
        verifyNoInteractions(scriptExecutionRepository, softwareNatsPublisher, retryStore);
    }

    @Test
    @DisplayName("update on a feature-enabled device: the bundle's auto-update is turned on for that device and package")
    void update_eligibleDevice_turnsAutoUpdateOn() {
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__brew-update", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(script("brew-update-id")));
        when(packageUpdateEligibility.isEligible(SoftwareAction.UPDATE, mac)).thenReturn(true);
        SoftwareAutoUpdate autoUpdate = SoftwareAutoUpdate.builder().enabled(true).build();
        SoftwareBundle bundle = bundle(SoftwareAction.UPDATE);
        bundle.getPackages().get(0).setSoftwareId("title-7");
        bundle.setAutoUpdate(autoUpdate);

        dispatcher.dispatch(bundle, mac);

        ArgumentCaptor<RunningExecutionRows> rows = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(autoUpdatePolicyService).turnOn(rows.capture(), eq(BrewPackageType.CASK), eq("title-7"),
                eq(autoUpdate), eq(bundle.getUpdateSettings()));
        assertThat(rows.getValue().getMachineIds()).containsExactly("m-1");
        assertThat(rows.getValue().getPackageName()).isEqualTo("slack");
    }

    @Test
    @DisplayName("update on a device without the feature: the script, as before")
    void update_notEligible_runsScript() {
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__brew-update", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(script("brew-update-id")));
        when(packageUpdateEligibility.isEligible(SoftwareAction.UPDATE, mac)).thenReturn(false);

        dispatcher.dispatch(bundle(SoftwareAction.UPDATE), mac);

        ArgumentCaptor<RunningExecutionRows> rows = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(scriptExecutionRepository).saveQueued(rows.capture());
        assertThat(rows.getValue().getMachineIds()).containsExactly("m-1");
        verify(softwareNatsPublisher).publishSoftware(eq("m-1"), any());
        verify(packageUpdateDispatchService, never()).dispatchAdminUpdate(any(), any(), any());
        verifyNoInteractions(autoUpdatePolicyService);
    }

    @Test
    @DisplayName("an OS-incompatible package is skipped on the order path too")
    void update_eligibleDevice_incompatiblePackage_skipped() {
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__winget-update", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(Script.builder().id("winget-update-id").type(ScriptType.SOFTWARE)
                        .supportedPlatforms(List.of(OsType.WINDOWS)).build()));
        when(packageUpdateEligibility.isEligible(SoftwareAction.UPDATE, mac)).thenReturn(true);

        SoftwareBundle bundle = bundle(SoftwareAction.UPDATE);
        bundle.setPackages(List.of(SoftwareBundlePackage.builder()
                .packageManager(PackageManagerType.WINGET).packageName("Google.Chrome").build()));
        dispatcher.dispatch(bundle, mac);

        verifyNoInteractions(packageUpdateDispatchService, scriptExecutionRepository, softwareNatsPublisher);
    }

    @Test
    @DisplayName("a winget package is skipped on a Windows device that cannot run winget")
    void update_deviceThatCannotRunTheManager_packageSkipped() {
        Machine server = machine("m-server", OsType.WINDOWS);
        server.setPackageManagers(Map.of(PackageManagerType.WINGET, PackageManagerState.UNSUPPORTED,
                PackageManagerType.CHOCO, PackageManagerState.PRESENT));
        when(packageManagerAvailability.isSoftwareManageable(server)).thenReturn(true);
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__winget-update", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(Script.builder().id("winget-update-id").type(ScriptType.SOFTWARE)
                        .supportedPlatforms(List.of(OsType.WINDOWS)).build()));
        when(packageUpdateEligibility.isEligible(SoftwareAction.UPDATE, server)).thenReturn(true);
        SoftwareBundle bundle = bundle(SoftwareAction.UPDATE);
        bundle.setPackages(List.of(SoftwareBundlePackage.builder()
                .packageManager(PackageManagerType.WINGET).packageName("Google.Chrome").build()));

        dispatcher.dispatch(bundle, server);

        verifyNoInteractions(packageUpdateDispatchService, scriptExecutionRepository, softwareNatsPublisher);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void dispatch_chocoUpdateOnDeviceThatDoesNotOwnThePackage_packageSkipped(boolean viaOrder) {
        // setup
        stubChocoScript(SoftwareScriptCode.CHOCO_UPDATE, "choco-update-id");
        when(packageManagerAvailability.isSoftwareManageable(win)).thenReturn(true);
        when(packageUpdateEligibility.isEligible(SoftwareAction.UPDATE, win)).thenReturn(viaOrder);
        when(chocoPackageOwnership.owns(win, CHOCO_PACKAGE)).thenReturn(false);

        // execution
        dispatcher.dispatch(chocoBundle(SoftwareAction.UPDATE), win);

        // verifications
        verifyNoInteractions(packageUpdateDispatchService, autoUpdatePolicyService, scriptExecutionRepository,
                softwareNatsPublisher, retryStore);
    }

    @Test
    void dispatch_chocoUpdateOnOwningEligibleDevice_orderSent() {
        // setup
        stubChocoScript(SoftwareScriptCode.CHOCO_UPDATE, "choco-update-id");
        when(packageManagerAvailability.isSoftwareManageable(win)).thenReturn(true);
        when(packageUpdateEligibility.isEligible(SoftwareAction.UPDATE, win)).thenReturn(true);
        when(chocoPackageOwnership.owns(win, CHOCO_PACKAGE)).thenReturn(true);

        // execution
        dispatcher.dispatch(chocoBundle(SoftwareAction.UPDATE), win);

        // verifications
        verify(packageUpdateDispatchService).dispatchAdminUpdate(rowsCaptor.capture(), isNull(), isNull());
        assertThat(rowsCaptor.getValue())
                .returns(List.of("m-win"), RunningExecutionRows::getMachineIds)
                .returns(PackageManagerType.CHOCO, RunningExecutionRows::getPackageManager)
                .returns(CHOCO_PACKAGE, RunningExecutionRows::getPackageName)
                .returns("choco-update-id", RunningExecutionRows::getScriptId);
    }

    @Test
    void dispatch_chocoUpdateOnOwningDeviceWithoutOrderFeature_scriptSentWithIdAndFeed() {
        // setup
        stubChocoScript(SoftwareScriptCode.CHOCO_UPDATE, "choco-update-id");
        when(packageManagerAvailability.isSoftwareManageable(win)).thenReturn(true);
        when(packageUpdateEligibility.isEligible(SoftwareAction.UPDATE, win)).thenReturn(false);
        when(chocoPackageOwnership.owns(win, CHOCO_PACKAGE)).thenReturn(true);

        // execution
        dispatcher.dispatch(chocoBundle(SoftwareAction.UPDATE), win);

        // verifications
        verify(softwareNatsPublisher).publishSoftware(eq("m-win"), messageCaptor.capture());
        assertThat(messageCaptor.getValue().getArgs()).containsExactly(CHOCO_PACKAGE, CHOCO_FEED_URL);
    }

    @Test
    void dispatch_chocoUpdateNotOwnedNextToAnotherPackage_otherPackageStillSent() {
        // setup
        stubChocoScript(SoftwareScriptCode.CHOCO_UPDATE, "choco-update-id");
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__winget-update", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(windowsScript("winget-update-id")));
        when(packageManagerAvailability.isSoftwareManageable(win)).thenReturn(true);
        when(packageUpdateEligibility.isEligible(SoftwareAction.UPDATE, win)).thenReturn(false);
        when(chocoPackageOwnership.owns(win, CHOCO_PACKAGE)).thenReturn(false);
        SoftwareBundle bundle = chocoBundle(SoftwareAction.UPDATE);
        bundle.setPackages(List.of(
                SoftwareBundlePackage.builder().packageManager(PackageManagerType.CHOCO).packageName(CHOCO_PACKAGE).build(),
                SoftwareBundlePackage.builder().packageManager(PackageManagerType.WINGET).packageName("Google.Chrome").build()));

        // execution
        dispatcher.dispatch(bundle, win);

        // verifications
        verify(scriptExecutionRepository).saveQueued(rowsCaptor.capture());
        assertThat(rowsCaptor.getValue())
                .returns(PackageManagerType.WINGET, RunningExecutionRows::getPackageManager)
                .returns("Google.Chrome", RunningExecutionRows::getPackageName);
    }

    @Test
    void dispatch_chocoInstall_sentWithoutConsultingOwnership() {
        // setup
        stubChocoScript(SoftwareScriptCode.CHOCO_INSTALL, "choco-install-id");
        when(packageManagerAvailability.isSoftwareManageable(win)).thenReturn(true);

        // execution
        dispatcher.dispatch(chocoBundle(SoftwareAction.INSTALL), win);

        // verifications
        verify(softwareNatsPublisher).publishSoftware(eq("m-win"), messageCaptor.capture());
        assertThat(messageCaptor.getValue().getArgs()).containsExactly(CHOCO_PACKAGE, CHOCO_FEED_URL);
        verifyNoInteractions(chocoPackageOwnership);
    }

    @Test
    void dispatch_wingetUpdate_sentWithoutConsultingOwnership() {
        // setup
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__winget-update", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(windowsScript("winget-update-id")));
        when(packageManagerAvailability.isSoftwareManageable(win)).thenReturn(true);
        when(packageUpdateEligibility.isEligible(SoftwareAction.UPDATE, win)).thenReturn(false);
        SoftwareBundle bundle = chocoBundle(SoftwareAction.UPDATE);
        bundle.setPackages(List.of(SoftwareBundlePackage.builder()
                .packageManager(PackageManagerType.WINGET).packageName("Google.Chrome").build()));

        // execution
        dispatcher.dispatch(bundle, win);

        // verifications
        verify(softwareNatsPublisher).publishSoftware(eq("m-win"), any(ScriptMessage.class));
        verifyNoInteractions(chocoPackageOwnership);
    }

    private void stubChocoScript(SoftwareScriptCode code, String scriptId) {
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, code.canonicalName(), ScriptType.SOFTWARE))
                .thenReturn(Optional.of(windowsScript(scriptId)));
    }

    private static PackageManagerProperties chocoEnabledProperties() {
        PackageManagerProperties properties = new PackageManagerProperties();
        properties.setChocoEnabled(true);
        properties.getChoco().setFeedUrl(CHOCO_FEED_URL);
        properties.getChoco().setVersion("2.7.5");
        properties.getChoco().setSha256("f86f99a1");
        return properties;
    }

    private static SoftwareBundle chocoBundle(SoftwareAction action) {
        return SoftwareBundle.builder()
                .id("b-1").tenantId(TENANT).createdBy("user-1").action(action)
                .packages(List.of(SoftwareBundlePackage.builder()
                        .packageManager(PackageManagerType.CHOCO).packageName(CHOCO_PACKAGE).build()))
                .build();
    }

    private static Script windowsScript(String id) {
        return Script.builder()
                .id(id).type(ScriptType.SOFTWARE)
                .scriptBody("run $args").shell(ScriptShell.POWERSHELL)
                .privilegeLevel(PrivilegeLevel.ADMIN).defaultTimeoutSeconds(540)
                .supportedPlatforms(List.of(OsType.WINDOWS))
                .build();
    }

    private static Machine chocoManagedMachine(String machineId) {
        Machine machine = machine(machineId, OsType.WINDOWS);
        machine.setPackageManagers(Map.of(PackageManagerType.WINGET, PackageManagerState.PRESENT,
                PackageManagerType.CHOCO, PackageManagerState.PRESENT));
        machine.setChocolatey(MachineChocolatey.builder().status(ChocolateyStatus.MANAGED).build());
        return machine;
    }

    private static SoftwareBundle bundle(SoftwareAction action) {
        return SoftwareBundle.builder()
                .id("b-1").tenantId(TENANT).createdBy("user-1").action(action)
                .packages(List.of(SoftwareBundlePackage.builder()
                        .packageManager(PackageManagerType.BREW).packageName("slack").brewPackageType(BrewPackageType.CASK)
                        .build()))
                .build();
    }

    private static Script script(String id) {
        return Script.builder()
                .id(id).type(ScriptType.SOFTWARE)
                .scriptBody("run \"$@\"").shell(ScriptShell.BASH)
                .privilegeLevel(PrivilegeLevel.USER).defaultTimeoutSeconds(1800)
                .supportedPlatforms(List.of(OsType.MAC_OS))
                .build();
    }

    private static Machine machine(String machineId, OsType osType) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setOsType(osType);
        return m;
    }
}
