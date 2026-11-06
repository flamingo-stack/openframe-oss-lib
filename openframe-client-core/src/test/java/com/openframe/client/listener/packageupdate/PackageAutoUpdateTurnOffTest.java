package com.openframe.client.listener.packageupdate;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareExecutionId;
import com.openframe.data.repository.rmm.PackageAutoUpdatePolicyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PackageAutoUpdateTurnOffTest {

    private static final String TENANT = "t1";
    private static final String VERSION = "152.0.7977.65";

    @Mock private PackageAutoUpdatePolicyRepository policyRepository;

    @InjectMocks private PackageAutoUpdateTurnOff turnOff;

    private PackageUpdateRequest request;
    private PackageAutoUpdatePolicy policy;

    @BeforeEach
    void setUp() {
        request = PackageUpdateRequest.builder()
                .tenantId(TENANT).requestId("req-1").source(PackageUpdateSource.AUTO)
                .executionId(SoftwareExecutionId.forAutoUpdate(TENANT, PackageManagerType.BREW, "google-chrome", VERSION))
                .packageManager(PackageManagerType.BREW).packageName("google-chrome").brewPackageType(BrewPackageType.CASK)
                .mode(PackageUpdateMode.FORCE).forceCountdownSeconds(60)
                .build();
        policy = PackageAutoUpdatePolicy.builder().id("p1").enabled(true).lastVersion(VERSION).build();
        when(policyRepository.findByTenantIdAndMachineIdAndPackageManagerAndPackageName(TENANT, "m1", PackageManagerType.BREW, "google-chrome"))
                .thenReturn(Optional.of(policy));
        when(policyRepository.disable(eq("p1"), eq(VERSION), eq("package-auto-update"), any())).thenReturn(1L);
    }

    @Test
    void packageNotOnTheDevice_policyTurnedOff() {
        turnOff.turnOffIfPackageRemoved(failed("NOT_INSTALLED"), request);

        verify(policyRepository).disable(eq("p1"), eq(VERSION), eq("package-auto-update"), any());
    }

    @Test
    void policyMovedOnBeforeTheWrite_turnOffMatchesNothing() {
        when(policyRepository.disable(eq("p1"), eq(VERSION), eq("package-auto-update"), any())).thenReturn(0L);

        turnOff.turnOffIfPackageRemoved(failed("NOT_INSTALLED"), request);

        verify(policyRepository).disable(eq("p1"), eq(VERSION), eq("package-auto-update"), any());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"NOT_UPGRADABLE", "MANAGER_ERROR", "TIMEOUT"})
    void otherFailure_policyStaysOn(String reason) {
        turnOff.turnOffIfPackageRemoved(failed(reason), request);

        policyNotTurnedOff();
    }

    @Test
    void anAdminsOrderFindingNoPackage_policyStaysOn() {
        request.setSource(PackageUpdateSource.ADMIN);

        turnOff.turnOffIfPackageRemoved(failed("NOT_INSTALLED"), request);

        policyNotTurnedOff();
    }

    @Test
    void olderVersionFindingNoPackage_policyStaysOn() {
        // the package may be back by the time a newer version was ordered
        policy.setLastVersion("153.0.0.1");

        turnOff.turnOffIfPackageRemoved(failed("NOT_INSTALLED"), request);

        policyNotTurnedOff();
    }

    @Test
    void policyAlreadyOff_notWrittenAgain() {
        policy.setEnabled(false);

        turnOff.turnOffIfPackageRemoved(failed("NOT_INSTALLED"), request);

        policyNotTurnedOff();
    }

    @Test
    void noPolicy_nothingToTurnOff() {
        when(policyRepository.findByTenantIdAndMachineIdAndPackageManagerAndPackageName(TENANT, "m1", PackageManagerType.BREW, "google-chrome"))
                .thenReturn(Optional.empty());

        turnOff.turnOffIfPackageRemoved(failed("NOT_INSTALLED"), request);

        policyNotTurnedOff();
    }

    @Test
    void noRequest_policyStaysOn() {
        turnOff.turnOffIfPackageRemoved(failed("NOT_INSTALLED"), null);

        policyNotTurnedOff();
    }

    private void policyNotTurnedOff() {
        verify(policyRepository, never()).disable(any(), any(), any(), any());
    }

    private static PackageUpdateDeviceState failed(String reason) {
        return PackageUpdateDeviceState.builder()
                .tenantId(TENANT).requestId("req-1").machineId("m1")
                .status(SoftwareActionStatus.FAILED).failedReason(reason)
                .build();
    }
}
