package com.openframe.client.service.rmm;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.BrewPackageType;
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
import com.openframe.data.nats.packageupdate.PackageUpdateDispatchService;
import com.openframe.data.nats.rmm.publisher.SoftwareNatsPublisher;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.rmm.software.BrewPackageManagerHandler;
import com.openframe.data.service.rmm.software.PackageAutoUpdatePolicyService;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.data.service.rmm.software.PackageManagerRegistry;
import com.openframe.data.service.rmm.software.PackageUpdateEligibilityService;
import com.openframe.data.service.rmm.software.WingetPackageManagerHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SoftwareBundleOnlineDispatcherTest {

    private static final String TENANT = "t-1";

    private final ScriptRepository scriptRepository = mock(ScriptRepository.class);
    private final PackageManagerRegistry registry =
            new PackageManagerRegistry(List.of(new BrewPackageManagerHandler(), new WingetPackageManagerHandler()));
    private final ScriptExecutionRepository scriptExecutionRepository = mock(ScriptExecutionRepository.class);
    private final SoftwareNatsPublisher softwareNatsPublisher = mock(SoftwareNatsPublisher.class);
    private final ScriptDeliveryRetryStore retryStore = mock(ScriptDeliveryRetryStore.class);
    private final PackageManagerAvailability packageManagerAvailability = mock(PackageManagerAvailability.class);
    private final PackageUpdateEligibilityService packageUpdateEligibility = mock(PackageUpdateEligibilityService.class);
    private final PackageUpdateDispatchService packageUpdateDispatchService = mock(PackageUpdateDispatchService.class);

    private final PackageAutoUpdatePolicyService autoUpdatePolicyService = mock(PackageAutoUpdatePolicyService.class);

    private final SoftwareBundleOnlineDispatcher dispatcher = new SoftwareBundleOnlineDispatcher(
            scriptRepository, registry, scriptExecutionRepository, softwareNatsPublisher, retryStore,
            packageManagerAvailability, packageUpdateEligibility, packageUpdateDispatchService, autoUpdatePolicyService);

    private final Machine mac = machine("m-1", OsType.MAC_OS);

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
