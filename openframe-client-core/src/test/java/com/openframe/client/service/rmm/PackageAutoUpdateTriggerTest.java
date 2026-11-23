package com.openframe.client.service.rmm;

import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptType;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionKind;
import com.openframe.data.document.rmm.software.SoftwareActionResult;
import com.openframe.data.document.rmm.software.SoftwareExecutionId;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.nats.packageupdate.PackageAutoUpdateWithdrawal;
import com.openframe.data.nats.packageupdate.PackageUpdateDispatchService;
import com.openframe.data.repository.rmm.PackageAutoUpdatePolicyRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.repository.rmm.SoftwareActionResultRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.software.BrewPackageManagerHandler;
import com.openframe.data.service.rmm.software.ChocoPackageManagerHandler;
import com.openframe.data.service.rmm.software.ChocoPackageOwnership;
import com.openframe.data.service.rmm.software.PackageCatalogVersions;
import com.openframe.data.service.rmm.software.PackageManagerRegistry;
import com.openframe.data.nats.packageupdate.PackageUpdateEligibilityService;
import com.openframe.data.service.rmm.software.WingetPackageManagerHandler;
import com.openframe.delivery.track.DeliveryTracker;
import com.openframe.data.service.rmm.MachinePlatformResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PackageAutoUpdateTriggerTest {

    private static final String TENANT = "t-1";
    private static final String LATEST = "152.0.7977.65";
    private static final String JOB = SoftwareExecutionId.forAutoUpdate(TENANT, PackageManagerType.BREW, "google-chrome", LATEST);
    private static final PackageUpdateSettings WAIT = PackageUpdateSettings.builder()
            .mode(PackageUpdateMode.WAIT).deadlineSeconds(604_800L).countdownSeconds(300).build();
    private static final PackageUpdateSettings FORCE = PackageUpdateSettings.builder()
            .mode(PackageUpdateMode.FORCE).countdownSeconds(60).build();
    private static final String CHOCO_PACKAGE = "googlechrome";
    private static final String CHOCO_LATEST = "159.0.8154.13";
    private static final String CHOCO_JOB =
            SoftwareExecutionId.forAutoUpdate(TENANT, PackageManagerType.CHOCO, CHOCO_PACKAGE, CHOCO_LATEST);

    private final PackageAutoUpdatePolicyRepository policyRepository = mock(PackageAutoUpdatePolicyRepository.class);
    private final PackageCatalogVersions catalogVersions = mock(PackageCatalogVersions.class);
    private final PackageUpdateEligibilityService eligibility = mock(PackageUpdateEligibilityService.class);
    private final ScriptRepository scriptRepository = mock(ScriptRepository.class);
    private final SoftwareActionResultRepository actionResultRepository = mock(SoftwareActionResultRepository.class);
    private final PackageUpdateDispatchService dispatchService = mock(PackageUpdateDispatchService.class);
    private final DeliveryTracker deliveryTracker = mock(DeliveryTracker.class);
    private final TenantIdProvider tenantIdProvider = mock(TenantIdProvider.class);
    private final MachinePlatformResolver machinePlatformResolver = mock(MachinePlatformResolver.class);
    private final ChocoPackageOwnership chocoPackageOwnership = mock(ChocoPackageOwnership.class);
    private final PackageManagerProperties packageManagerProperties = chocoEnabledProperties();

    private final ArgumentCaptor<RunningExecutionRows> rowsCaptor = ArgumentCaptor.forClass(RunningExecutionRows.class);
    private final ArgumentCaptor<SoftwareActionResult> jobCaptor = ArgumentCaptor.forClass(SoftwareActionResult.class);

    private final PackageAutoUpdateTrigger trigger = new PackageAutoUpdateTrigger(policyRepository, catalogVersions,
            eligibility,
            new PackageManagerRegistry(
                    List.of(new BrewPackageManagerHandler(), new WingetPackageManagerHandler(),
                            new ChocoPackageManagerHandler(packageManagerProperties)),
                    packageManagerProperties),
            scriptRepository, actionResultRepository, dispatchService, new PackageAutoUpdateWithdrawal(deliveryTracker), tenantIdProvider,
            machinePlatformResolver, chocoPackageOwnership);

    @BeforeEach
    void setUp() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(machinePlatformResolver.supporting(anyList(), any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(catalogVersions.hasLatest(PackageManagerType.BREW, "google-chrome", BrewPackageType.CASK)).thenReturn(true);
        when(catalogVersions.latest(PackageManagerType.BREW, "google-chrome", BrewPackageType.CASK)).thenReturn(LATEST);
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__brew-update", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(Script.builder().id("brew-update-id").privilegeLevel(PrivilegeLevel.USER)
                        .defaultTimeoutSeconds(1800).build()));
        when(actionResultRepository.findByTenantIdAndExecutionId(TENANT, JOB)).thenReturn(Optional.empty());
    }

    @Test
    @DisplayName("a device that cannot run the package's manager is not offered to the order at all")
    void deviceThatCannotRunTheManager_neverOrdered() {
        when(policyRepository.findByTenantIdAndEnabledTrue(TENANT)).thenReturn(List.of(
                chrome("p1", "m1", "151.0.7922.98", WAIT),
                chrome("p2", "m2", "151.0.7922.98", WAIT)));
        when(machinePlatformResolver.supporting(List.of("m1", "m2"), PackageManagerType.BREW)).thenReturn(List.of("m1"));
        when(eligibility.eligibleConnectedMachines(SoftwareAction.UPDATE, List.of("m1"))).thenReturn(Set.of("m1"));
        when(dispatchService.dispatchAutoUpdate(any(), any(), any())).thenReturn("req-new");

        trigger.run();

        ArgumentCaptor<RunningExecutionRows> rows = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(dispatchService).dispatchAutoUpdate(rows.capture(), any(), any());
        assertThat(rows.getValue().getMachineIds()).containsExactly("m1");
    }

    @Test
    @DisplayName("a new catalog version: one AUTO_UPDATE job, an AUTO order to the outdated devices, their policies marked")
    void newVersion_ordersOutdatedDevices() {
        when(policyRepository.findByTenantIdAndEnabledTrue(TENANT)).thenReturn(List.of(
                chrome("p1", "m1", "151.0.7922.98", WAIT),
                chrome("p2", "m2", "151.0.7922.98", WAIT),
                chrome("p3", "m3", LATEST, WAIT)));
        when(eligibility.eligibleConnectedMachines(eq(SoftwareAction.UPDATE), anyCollection())).thenReturn(Set.of("m1", "m2"));
        when(dispatchService.dispatchAutoUpdate(any(), any(), any())).thenReturn("req-new");

        trigger.run();

        ArgumentCaptor<SoftwareActionResult> job = ArgumentCaptor.forClass(SoftwareActionResult.class);
        verify(actionResultRepository).save(job.capture());
        assertThat(job.getValue()).satisfies(row -> {
            assertThat(row.getId()).isEqualTo(JOB);
            assertThat(row.getKind()).isEqualTo(SoftwareActionKind.AUTO_UPDATE);
            assertThat(row.getAction()).isEqualTo(SoftwareAction.UPDATE);
            assertThat(row.getVersion()).isEqualTo(LATEST);
            assertThat(row.getMachineIds()).containsExactly("m1", "m2");
            assertThat(row.getTotalMachineCount()).isEqualTo(2);
            assertThat(row.getInitiatedBy()).isNull();
        });
        ArgumentCaptor<RunningExecutionRows> order = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(dispatchService).dispatchAutoUpdate(order.capture(), eq(BrewPackageType.CASK), eq(WAIT));
        assertThat(order.getValue()).satisfies(rows -> {
            assertThat(rows.getExecutionId()).isEqualTo(JOB);
            assertThat(rows.getMachineIds()).containsExactly("m1", "m2");
            assertThat(rows.getSource()).isEqualTo(ExecutionSource.PACKAGE_AUTO_UPDATE);
            assertThat(rows.getSoftwareAction()).isEqualTo(SoftwareAction.UPDATE);
            assertThat(rows.getScriptId()).isEqualTo("brew-update-id");
        });
        verify(policyRepository).markOrdered(List.of("p1", "p2"), LATEST, "req-new");
    }

    @Test
    @DisplayName("every device already on the catalog version: nothing is ordered")
    void upToDate_nothingOrdered() {
        when(policyRepository.findByTenantIdAndEnabledTrue(TENANT)).thenReturn(List.of(chrome("p1", "m1", LATEST, WAIT)));

        trigger.run();

        verifyNoInteractions(eligibility, actionResultRepository, dispatchService);
    }

    @Test
    @DisplayName("a package the catalog does not carry (Chocolatey): nothing is ordered")
    void notInCatalog_nothingOrdered() {
        when(policyRepository.findByTenantIdAndEnabledTrue(TENANT)).thenReturn(List.of(PackageAutoUpdatePolicy.builder()
                .id("p1").tenantId(TENANT).machineId("m1").packageManager(PackageManagerType.CHOCO)
                .packageName("googlechrome").enabled(true).build()));
        when(catalogVersions.hasLatest(PackageManagerType.CHOCO, "googlechrome", null)).thenReturn(false);

        trigger.run();

        verifyNoInteractions(eligibility, actionResultRepository, dispatchService);
    }

    @Test
    @DisplayName("an update script missing for the tenant fails that package only: no job, no order, the next package still runs")
    void updateScriptNotSeeded_failsThatPackageOnly() {
        when(policyRepository.findByTenantIdAndEnabledTrue(TENANT)).thenReturn(List.of(
                PackageAutoUpdatePolicy.builder().id("p0").tenantId(TENANT).machineId("m0")
                        .packageManager(PackageManagerType.WINGET).packageName("Google.Chrome").enabled(true).build(),
                chrome("p1", "m1", "151", WAIT)));
        when(catalogVersions.hasLatest(PackageManagerType.WINGET, "Google.Chrome", null)).thenReturn(true);
        when(catalogVersions.latest(PackageManagerType.WINGET, "Google.Chrome", null)).thenReturn("142.0.7444.60");
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__winget-update", ScriptType.SOFTWARE))
                .thenReturn(Optional.empty());
        when(eligibility.eligibleConnectedMachines(eq(SoftwareAction.UPDATE), anyCollection()))
                .thenReturn(Set.of("m0", "m1"));

        trigger.run();

        verify(policyRepository, never()).markOrdered(eq(List.of("p0")), eq("142.0.7444.60"), any());
        verify(dispatchService).dispatchAutoUpdate(any(), eq(BrewPackageType.CASK), eq(WAIT));
        verify(policyRepository).markOrdered(eq(List.of("p1")), eq(LATEST), any());
    }

    @Test
    @DisplayName("a device whose agent cannot take the order, or that is no longer connected, is neither ordered nor marked")
    void ineligibleDevice_leftForLater() {
        when(policyRepository.findByTenantIdAndEnabledTrue(TENANT)).thenReturn(List.of(chrome("p1", "m1", "151", WAIT)));
        when(eligibility.eligibleConnectedMachines(eq(SoftwareAction.UPDATE), anyCollection())).thenReturn(Set.of());

        trigger.run();

        verify(dispatchService, never()).dispatchAutoUpdate(any(), any(), any());
        verify(policyRepository, never()).markOrdered(any(), any(), any());
    }

    @Test
    @DisplayName("what the engine still holds of the previous order is withdrawn before the new one, so a retry of it cannot replace the new order on the agent")
    void newVersion_withdrawsThePreviousOrderFirst() {
        PackageAutoUpdatePolicy previous = chrome("p1", "m1", "151", WAIT);
        previous.setRequestId("req-old");
        when(policyRepository.findByTenantIdAndEnabledTrue(TENANT)).thenReturn(List.of(previous, chrome("p2", "m2", "151", WAIT)));
        when(eligibility.eligibleConnectedMachines(eq(SoftwareAction.UPDATE), anyCollection())).thenReturn(Set.of("m1", "m2"));

        trigger.run();

        InOrder order = inOrder(deliveryTracker, dispatchService);
        order.verify(deliveryTracker).cancel(eq(DeliveryType.PACKAGE_UPDATE), eq("req-old"), eq("m1"), any());
        order.verify(deliveryTracker).cancel(eq(DeliveryType.PACKAGE_UPDATE), eq("req-old:deadline"), eq("m1"), any());
        order.verify(dispatchService).dispatchAutoUpdate(any(), any(), any());
        verify(deliveryTracker, times(2)).cancel(any(), any(), any(), any());   // p2 was never ordered: nothing to withdraw
    }

    @Test
    @DisplayName("a device not ordered in this pass keeps what the engine holds for it")
    void ineligibleDevice_keepsItsPreviousOrder() {
        PackageAutoUpdatePolicy previous = chrome("p1", "m1", "151", WAIT);
        previous.setRequestId("req-old");
        when(policyRepository.findByTenantIdAndEnabledTrue(TENANT)).thenReturn(List.of(previous));
        when(eligibility.eligibleConnectedMachines(eq(SoftwareAction.UPDATE), anyCollection())).thenReturn(Set.of());

        trigger.run();

        verifyNoInteractions(deliveryTracker);
    }

    @Test
    @DisplayName("devices that reach a version later join its job; devices with other settings get their own order")
    void laterDevicesJoinTheJob_settingsGroupsOrderedApart() {
        SoftwareActionResult existing = SoftwareActionResult.builder()
                .id(JOB).tenantId(TENANT).executionId(JOB).kind(SoftwareActionKind.AUTO_UPDATE)
                .machineIds(List.of("m1")).totalMachineCount(1).build();
        when(actionResultRepository.findByTenantIdAndExecutionId(TENANT, JOB)).thenReturn(Optional.of(existing));
        when(policyRepository.findByTenantIdAndEnabledTrue(TENANT)).thenReturn(List.of(
                chrome("p2", "m2", "151", WAIT),
                chrome("p3", "m3", null, FORCE)));
        when(eligibility.eligibleConnectedMachines(eq(SoftwareAction.UPDATE), anyCollection())).thenReturn(Set.of("m2", "m3"));

        trigger.run();

        ArgumentCaptor<SoftwareActionResult> job = ArgumentCaptor.forClass(SoftwareActionResult.class);
        verify(actionResultRepository).save(job.capture());
        assertThat(job.getValue().getMachineIds()).containsExactly("m1", "m2", "m3");
        assertThat(job.getValue().getTotalMachineCount()).isEqualTo(3);
        verify(dispatchService, times(2)).dispatchAutoUpdate(any(), eq(BrewPackageType.CASK), any());
        verify(dispatchService).dispatchAutoUpdate(any(), any(), eq(WAIT));
        verify(dispatchService).dispatchAutoUpdate(any(), any(), eq(FORCE));
        verify(policyRepository).markOrdered(eq(List.of("p2")), eq(LATEST), any());
        verify(policyRepository).markOrdered(eq(List.of("p3")), eq(LATEST), any());
    }

    @Test
    void run_chocoOutdatedPolicies_onlyOwningDevicesOrdered() {
        // setup
        stubChocoCatalogAndScript();
        when(policyRepository.findByTenantIdAndEnabledTrue(TENANT)).thenReturn(List.of(
                choco("p1", "m1", "158.0.8100.2"),
                choco("p2", "m2", "158.0.8100.2")));
        stubEveryMachineEligible();
        when(chocoPackageOwnership.owners(anyCollection(), eq(CHOCO_PACKAGE))).thenReturn(List.of("m2"));
        when(dispatchService.dispatchAutoUpdate(any(RunningExecutionRows.class), isNull(), eq(WAIT))).thenReturn("req-choco");

        // execution
        trigger.run();

        // verifications
        verify(dispatchService).dispatchAutoUpdate(rowsCaptor.capture(), isNull(), eq(WAIT));
        assertThat(rowsCaptor.getValue())
                .returns(List.of("m2"), RunningExecutionRows::getMachineIds)
                .returns(PackageManagerType.CHOCO, RunningExecutionRows::getPackageManager)
                .returns(CHOCO_PACKAGE, RunningExecutionRows::getPackageName)
                .returns("choco-update-id", RunningExecutionRows::getScriptId)
                .returns(CHOCO_JOB, RunningExecutionRows::getExecutionId);
        verify(policyRepository).markOrdered(List.of("p2"), CHOCO_LATEST, "req-choco");
    }

    @Test
    void run_chocoOutdatedPolicies_jobListsOnlyOwningDevices() {
        // setup
        stubChocoCatalogAndScript();
        when(policyRepository.findByTenantIdAndEnabledTrue(TENANT)).thenReturn(List.of(
                choco("p1", "m1", "158.0.8100.2"),
                choco("p2", "m2", "158.0.8100.2")));
        stubEveryMachineEligible();
        when(chocoPackageOwnership.owners(anyCollection(), eq(CHOCO_PACKAGE))).thenReturn(List.of("m2"));

        // execution
        trigger.run();

        // verifications
        verify(actionResultRepository).save(jobCaptor.capture());
        assertThat(jobCaptor.getValue())
                .returns(CHOCO_JOB, SoftwareActionResult::getId)
                .returns(List.of("m2"), SoftwareActionResult::getMachineIds)
                .returns(1, SoftwareActionResult::getTotalMachineCount);
    }

    @Test
    void run_chocoOutdatedPoliciesNoOwningDevice_nothingDispatched() {
        // setup
        stubChocoCatalogAndScript();
        when(policyRepository.findByTenantIdAndEnabledTrue(TENANT)).thenReturn(List.of(
                choco("p1", "m1", "158.0.8100.2"),
                choco("p2", "m2", "158.0.8100.2")));
        stubEveryMachineEligible();
        when(chocoPackageOwnership.owners(anyCollection(), eq(CHOCO_PACKAGE))).thenReturn(List.of());

        // execution
        trigger.run();

        // verifications
        verifyNoInteractions(dispatchService, actionResultRepository, deliveryTracker);
        verify(policyRepository, never()).markOrdered(anyCollection(), eq(CHOCO_LATEST), any(String.class));
    }

    @Test
    void run_brewOutdatedPolicies_chocoOwnershipNotConsulted() {
        // setup
        when(policyRepository.findByTenantIdAndEnabledTrue(TENANT)).thenReturn(List.of(
                chrome("p1", "m1", "151.0.7922.98", WAIT),
                chrome("p2", "m2", "151.0.7922.98", WAIT)));
        stubEveryMachineEligible();

        // execution
        trigger.run();

        // verifications
        verify(dispatchService).dispatchAutoUpdate(rowsCaptor.capture(), eq(BrewPackageType.CASK), eq(WAIT));
        assertThat(rowsCaptor.getValue().getMachineIds()).containsExactly("m1", "m2");
        verifyNoInteractions(chocoPackageOwnership);
    }

    private void stubChocoCatalogAndScript() {
        when(catalogVersions.hasLatest(PackageManagerType.CHOCO, CHOCO_PACKAGE, null)).thenReturn(true);
        when(catalogVersions.latest(PackageManagerType.CHOCO, CHOCO_PACKAGE, null)).thenReturn(CHOCO_LATEST);
        when(scriptRepository.findByTenantIdAndNameAndType(
                TENANT, SoftwareScriptCode.CHOCO_UPDATE.canonicalName(), ScriptType.SOFTWARE))
                .thenReturn(Optional.of(Script.builder().id("choco-update-id").privilegeLevel(PrivilegeLevel.ADMIN)
                        .defaultTimeoutSeconds(540).build()));
        when(actionResultRepository.findByTenantIdAndExecutionId(TENANT, CHOCO_JOB)).thenReturn(Optional.empty());
    }

    private void stubEveryMachineEligible() {
        when(eligibility.eligibleConnectedMachines(eq(SoftwareAction.UPDATE), anyCollection()))
                .thenAnswer(invocation -> Set.copyOf(invocation.<Collection<String>>getArgument(1)));
    }

    private static PackageManagerProperties chocoEnabledProperties() {
        PackageManagerProperties properties = new PackageManagerProperties();
        properties.setChocoEnabled(true);
        properties.getChoco().setFeedUrl("https://feed.openframe.test/choco/index.json");
        properties.getChoco().setVersion("2.7.5");
        properties.getChoco().setSha256("f86f99a1");
        return properties;
    }

    private static PackageAutoUpdatePolicy choco(String id, String machineId, String lastVersion) {
        return PackageAutoUpdatePolicy.builder()
                .id(id).tenantId(TENANT).machineId(machineId)
                .packageManager(PackageManagerType.CHOCO).packageName(CHOCO_PACKAGE)
                .enabled(true).settings(WAIT).lastVersion(lastVersion)
                .build();
    }

    private static PackageAutoUpdatePolicy chrome(String id, String machineId, String lastVersion,
                                                  PackageUpdateSettings settings) {
        return PackageAutoUpdatePolicy.builder()
                .id(id).tenantId(TENANT).machineId(machineId)
                .packageManager(PackageManagerType.BREW).packageName("google-chrome").brewPackageType(BrewPackageType.CASK)
                .enabled(true).settings(settings).lastVersion(lastVersion)
                .build();
    }
}
