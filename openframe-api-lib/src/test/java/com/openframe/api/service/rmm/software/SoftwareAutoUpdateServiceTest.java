package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareAutoUpdatePolicyResponse;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdate;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.nats.packageupdate.PackageAutoUpdateWithdrawal;
import com.openframe.data.repository.rmm.PackageAutoUpdatePolicyRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.software.PackageAutoUpdatePolicyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareAutoUpdateServiceTest {

    private static final String TENANT = "t1";
    private static final Instant EARLIER = Instant.parse("2026-11-01T10:00:00Z");
    private static final Instant LATER = Instant.parse("2026-11-02T10:00:00Z");
    private static final PackageUpdateSettings WAIT = PackageUpdateSettings.builder()
            .mode(PackageUpdateMode.WAIT).deadlineSeconds(604_800L).countdownSeconds(300).build();
    private static final PackageUpdateSettings FORCE = PackageUpdateSettings.builder()
            .mode(PackageUpdateMode.FORCE).countdownSeconds(60).build();
    private static final PackageCatalogEntry CHROME = PackageCatalogEntry.builder()
            .manager(PackageManagerType.WINGET).packageId("Google.Chrome").build();

    @Mock private PackageAutoUpdatePolicyRepository policyRepository;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private PackageAutoUpdateWithdrawal withdrawal;
    @Mock private PackageAutoUpdatePolicyService packageAutoUpdatePolicyService;

    @Captor private ArgumentCaptor<RunningExecutionRows> executionCaptor;
    @Captor private ArgumentCaptor<PackageAutoUpdatePolicy> templateCaptor;

    @InjectMocks private SoftwareAutoUpdateService service;

    @BeforeEach
    void setUp() {
        lenient().when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
    }

    @Test
    void software_onWhileAnyDeviceKeepsIt_offOnceAllAreOff_nullWithoutPolicies() {
        when(policyRepository.findByTenantIdAndSoftwareIdIn(eq(TENANT), anyCollection())).thenReturn(List.of(
                policy("m1", "chrome", true), policy("m2", "chrome", false),
                policy("m1", "slack", false), policy("m2", "slack", false)));
        List<SoftwareResponse> rows = List.of(software("chrome"), software("slack"), software("zoom"));

        service.applyToSoftware(rows);

        assertThat(rows).extracting(SoftwareResponse::getId, SoftwareResponse::getAutoUpdate).containsExactly(
                tuple("chrome", SoftwareAutoUpdateStatus.ON),
                tuple("slack", SoftwareAutoUpdateStatus.OFF),
                tuple("zoom", null));
    }

    @Test
    void softwareOnDevice_readsOnlyThatDevicesPolicies() {
        when(policyRepository.findByTenantIdAndMachineIdAndSoftwareIdIn(eq(TENANT), eq("m2"), anyCollection()))
                .thenReturn(List.of(policy("m2", "chrome", false)));
        List<SoftwareResponse> rows = List.of(software("chrome"), software("slack"));

        service.applyToSoftwareOnDevice("m2", rows);

        assertThat(rows).extracting(SoftwareResponse::getAutoUpdate)
                .containsExactly(SoftwareAutoUpdateStatus.OFF, null);
    }

    @Test
    void devices_eachDeviceItsOwnState() {
        when(policyRepository.findByTenantIdAndSoftwareIdAndMachineIdIn(eq(TENANT), eq("chrome"), anyCollection()))
                .thenReturn(List.of(policy("m1", "chrome", true), policy("m2", "chrome", false)));
        List<SoftwareOnDeviceResponse> rows = List.of(onDevice("m1"), onDevice("m2"), onDevice("m3"));

        service.applyToDevices("chrome", rows);

        assertThat(rows).extracting(SoftwareOnDeviceResponse::getAutoUpdate)
                .containsExactly(SoftwareAutoUpdateStatus.ON, SoftwareAutoUpdateStatus.OFF, null);
    }

    @Test
    void emptyPage_noLookup() {
        service.applyToSoftware(List.of());
        service.applyToDevices("chrome", List.of());

        verifyNoInteractions(policyRepository);
    }

    @Test
    void getPolicy_noPolicies_offWithoutSettingsAndDevices() {
        when(policyRepository.findByTenantIdAndSoftwareIdIn(TENANT, List.of("chrome"))).thenReturn(List.of());

        SoftwareAutoUpdatePolicyResponse result = service.getPolicy("chrome");

        assertThat(result)
                .extracting(SoftwareAutoUpdatePolicyResponse::isEnabled, SoftwareAutoUpdatePolicyResponse::getSettings,
                        SoftwareAutoUpdatePolicyResponse::getMachineIds)
                .containsExactly(false, null, List.of());
    }

    @Test
    void getPolicy_oneDevice_onWithItsSettingsAndDevice() {
        when(policyRepository.findByTenantIdAndSoftwareIdIn(TENANT, List.of("chrome")))
                .thenReturn(List.of(policy("m1", true, WAIT, EARLIER)));

        SoftwareAutoUpdatePolicyResponse result = service.getPolicy("chrome");

        assertThat(result)
                .extracting(SoftwareAutoUpdatePolicyResponse::isEnabled, SoftwareAutoUpdatePolicyResponse::getSettings,
                        SoftwareAutoUpdatePolicyResponse::getMachineIds)
                .containsExactly(true, WAIT, List.of("m1"));
    }

    @Test
    void getPolicy_devicesWithDifferentSettings_settingsOfTheOneUpdatedLast() {
        when(policyRepository.findByTenantIdAndSoftwareIdIn(TENANT, List.of("chrome")))
                .thenReturn(List.of(policy("m1", true, WAIT, EARLIER), policy("m2", true, FORCE, LATER)));

        SoftwareAutoUpdatePolicyResponse result = service.getPolicy("chrome");

        assertThat(result)
                .extracting(SoftwareAutoUpdatePolicyResponse::isEnabled, SoftwareAutoUpdatePolicyResponse::getSettings,
                        SoftwareAutoUpdatePolicyResponse::getMachineIds)
                .containsExactly(true, FORCE, List.of("m1", "m2"));
    }

    @Test
    void getPolicy_turnedOffPolicies_leftOut() {
        when(policyRepository.findByTenantIdAndSoftwareIdIn(TENANT, List.of("chrome")))
                .thenReturn(List.of(policy("m1", true, WAIT, EARLIER), policy("m2", false, FORCE, LATER)));

        SoftwareAutoUpdatePolicyResponse result = service.getPolicy("chrome");

        assertThat(result)
                .extracting(SoftwareAutoUpdatePolicyResponse::isEnabled, SoftwareAutoUpdatePolicyResponse::getSettings,
                        SoftwareAutoUpdatePolicyResponse::getMachineIds)
                .containsExactly(true, WAIT, List.of("m1"));
    }

    @Test
    void getPolicy_onlyTurnedOffPolicies_off() {
        when(policyRepository.findByTenantIdAndSoftwareIdIn(TENANT, List.of("chrome")))
                .thenReturn(List.of(policy("m1", false, WAIT, EARLIER)));

        SoftwareAutoUpdatePolicyResponse result = service.getPolicy("chrome");

        assertThat(result)
                .extracting(SoftwareAutoUpdatePolicyResponse::isEnabled, SoftwareAutoUpdatePolicyResponse::getSettings,
                        SoftwareAutoUpdatePolicyResponse::getMachineIds)
                .containsExactly(false, null, List.of());
    }

    @Test
    void turnOn_devicesWithoutAPolicy_getAPolicyOfTheManagingPackageLinkedToTheSoftware() {
        PackageCatalogEntry slack = PackageCatalogEntry.builder()
                .manager(PackageManagerType.BREW).packageId("slack").brewType(BrewPackageType.CASK).build();
        SoftwareAutoUpdate enabled = SoftwareAutoUpdate.builder().enabled(true).build();

        service.turnOn("title-7", slack, List.of("m1", "m2"), WAIT, "admin@x");

        verify(packageAutoUpdatePolicyService).turnOn(executionCaptor.capture(), eq(BrewPackageType.CASK),
                eq("title-7"), eq(enabled), eq(WAIT));
        assertThat(executionCaptor.getValue())
                .extracting(RunningExecutionRows::getTenantId, RunningExecutionRows::getPackageManager,
                        RunningExecutionRows::getPackageName, RunningExecutionRows::getMachineIds,
                        RunningExecutionRows::getInitiatedBy)
                .containsExactly(TENANT, PackageManagerType.BREW, "slack", List.of("m1", "m2"), "admin@x");
    }

    @Test
    void turnOn_deviceAlreadyOnForThePackage_getsTheSettingsAndNoNewPolicy() {
        when(policyRepository.findByTenantIdAndSoftwareIdIn(TENANT, List.of("chrome")))
                .thenReturn(List.of(chromePolicy("m1", true)));

        service.turnOn("chrome", CHROME, List.of("m1"), FORCE, "admin@x");

        verify(policyRepository).updateSettings(templateCaptor.capture(), eq(List.of("m1")));
        assertThat(templateCaptor.getValue())
                .extracting(PackageAutoUpdatePolicy::getTenantId, PackageAutoUpdatePolicy::getSoftwareId,
                        PackageAutoUpdatePolicy::getPackageManager, PackageAutoUpdatePolicy::getPackageName,
                        PackageAutoUpdatePolicy::getSettings, PackageAutoUpdatePolicy::getUpdatedBy)
                .containsExactly(TENANT, "chrome", PackageManagerType.WINGET, "Google.Chrome", FORCE, "admin@x");
        verifyNoInteractions(packageAutoUpdatePolicyService);
    }

    @Test
    void turnOn_keptTurnedOffAndNewDevices_keptGetTheSettingsTheOthersAPolicy() {
        when(policyRepository.findByTenantIdAndSoftwareIdIn(TENANT, List.of("chrome")))
                .thenReturn(List.of(chromePolicy("m1", true), chromePolicy("m2", false)));
        SoftwareAutoUpdate enabled = SoftwareAutoUpdate.builder().enabled(true).build();

        service.turnOn("chrome", CHROME, List.of("m1", "m2", "m3"), FORCE, "admin@x");

        verify(policyRepository).updateSettings(any(PackageAutoUpdatePolicy.class), eq(List.of("m1")));
        verify(packageAutoUpdatePolicyService).turnOn(executionCaptor.capture(), isNull(), eq("chrome"), eq(enabled),
                eq(FORCE));
        assertThat(executionCaptor.getValue().getMachineIds()).containsExactly("m2", "m3");
    }

    @Test
    void turnOn_devicesOutsideTheSelection_turnedOffThenWithdrawn() {
        PackageAutoUpdatePolicy selected = chromePolicy("m1", true);
        PackageAutoUpdatePolicy outside = chromePolicy("m3", false);
        when(policyRepository.findByTenantIdAndSoftwareIdIn(TENANT, List.of("chrome")))
                .thenReturn(List.of(selected, outside));

        service.turnOn("chrome", CHROME, List.of("m1", "m2"), WAIT, "admin@x");

        InOrder order = inOrder(policyRepository, withdrawal);
        order.verify(policyRepository)
                .disableBySoftwareIdAndMachineIdNotIn(TENANT, "chrome", List.of("m1", "m2"), "admin@x");
        order.verify(withdrawal).withdraw(outside, "auto-update turned off");
        verify(withdrawal, never()).withdraw(eq(selected), any());
    }

    @Test
    void turnOff_disablesTheSoftwaresPolicies() {
        service.turnOff("chrome", "admin@x");

        verify(policyRepository).disableBySoftwareId(TENANT, "chrome", "admin@x");
    }

    @Test
    void turnOff_withdrawsWhatTheEngineStillHolds_afterThePoliciesAreOff() {
        PackageAutoUpdatePolicy m1 = policy("m1", "chrome", false);
        PackageAutoUpdatePolicy m2 = policy("m2", "chrome", false);
        when(policyRepository.findByTenantIdAndSoftwareIdIn(TENANT, List.of("chrome"))).thenReturn(List.of(m1, m2));

        service.turnOff("chrome", "admin@x");

        InOrder order = inOrder(policyRepository, withdrawal);
        order.verify(policyRepository).disableBySoftwareId(TENANT, "chrome", "admin@x");
        order.verify(withdrawal).withdraw(eq(m1), any());
        order.verify(withdrawal).withdraw(eq(m2), any());
    }

    @Test
    void titleFromPolicies_namedAfterThePackage_orTheIdWithoutOne() {
        PackageAutoUpdatePolicy unnamed = policy("m1", "3522", false);
        PackageAutoUpdatePolicy named = policy("m2", "3522", false);
        named.setPackageName("7zip.7zip");
        List<PackageAutoUpdatePolicy> policies = List.of(unnamed, named);
        when(policyRepository.findByTenantIdAndSoftwareIdIn(eq(TENANT), anyCollection()))
                .thenReturn(policies).thenReturn(List.of());

        SoftwareResponse title = service.titleFromPolicies("3522");
        SoftwareResponse bare = service.titleFromPolicies("3522");

        assertThat(title).extracting(SoftwareResponse::getId, SoftwareResponse::getName)
                .containsExactly("3522", "7zip.7zip");
        assertThat(bare.getName()).isEqualTo("3522");
    }

    @Test
    void hasPolicy_asksForTheTenantsPolicies() {
        when(policyRepository.existsByTenantIdAndSoftwareId(TENANT, "3522")).thenReturn(true);
        when(policyRepository.existsByTenantIdAndSoftwareId(TENANT, "42")).thenReturn(false);

        assertThat(service.hasPolicy("3522")).isTrue();
        assertThat(service.hasPolicy("42")).isFalse();
    }

    private static PackageAutoUpdatePolicy policy(String machineId, String softwareId, boolean enabled) {
        return PackageAutoUpdatePolicy.builder()
                .tenantId(TENANT).machineId(machineId).softwareId(softwareId).enabled(enabled).build();
    }

    private static PackageAutoUpdatePolicy policy(String machineId, boolean enabled, PackageUpdateSettings settings,
                                                  Instant updatedAt) {
        return PackageAutoUpdatePolicy.builder()
                .tenantId(TENANT).machineId(machineId).softwareId("chrome").enabled(enabled)
                .settings(settings).updatedAt(updatedAt).build();
    }

    private static PackageAutoUpdatePolicy chromePolicy(String machineId, boolean enabled) {
        return PackageAutoUpdatePolicy.builder()
                .tenantId(TENANT).machineId(machineId).softwareId("chrome").enabled(enabled)
                .packageManager(PackageManagerType.WINGET).packageName("Google.Chrome").build();
    }

    private static SoftwareResponse software(String id) {
        return SoftwareResponse.builder().id(id).build();
    }

    private static SoftwareOnDeviceResponse onDevice(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        return SoftwareOnDeviceResponse.builder().device(machine).build();
    }
}
