package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.repository.rmm.SoftwareActionResultRepository;
import com.openframe.data.repository.rmm.SoftwareBundleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareBundleRepository;
import com.openframe.data.service.rmm.MachinePlatformResolver;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareBundleEligibilityTest {

    private static final String MACHINE_ID = "machine-1";

    @Mock private SoftwareBundleRepository bundleRepository;
    @Mock private SoftwareBundleOnlineDispatchRepository onlineDispatchRepository;
    @Mock private SoftwareScheduleService softwareScheduleService;
    @Mock private SoftwareActionResultRepository softwareActionResultRepository;
    @Mock private MachinePlatformResolver machinePlatformResolver;
    @Mock private PackageManagerAvailability packageManagerAvailability;
    @Mock private SoftwarePackageSelectionResolver softwarePackageSelectionResolver;

    @InjectMocks private SoftwareBundleService service;

    @Test
    void requireDeviceEligibility_knownIncompatibleOs_rejectsWithoutCreatingBundle() {
        // setup
        List<String> machineIds = List.of(MACHINE_ID);
        List<SoftwarePackageInput> packages = List.of(brewPackage());
        when(machinePlatformResolver.osTypesByMachineId(machineIds)).thenReturn(Map.of(MACHINE_ID, OsType.WINDOWS));

        // execution
        Throwable failure = catchThrowable(() -> service.requireDeviceEligibility(machineIds, packages));

        // verifications
        assertThat(failure).isInstanceOf(BadRequestException.class).hasMessageContaining(MACHINE_ID);
        verifyNoInteractions(bundleRepository, onlineDispatchRepository, softwareActionResultRepository, softwareScheduleService);
    }

    @Test
    void requireDeviceEligibility_unknownOs_passesWithoutCreatingBundle() {
        // setup
        List<String> machineIds = List.of(MACHINE_ID);
        List<SoftwarePackageInput> packages = List.of(brewPackage());

        // execution
        Throwable failure = catchThrowable(() -> service.requireDeviceEligibility(machineIds, packages));

        // verifications
        assertThat(failure).isNull();
        verifyNoInteractions(bundleRepository, onlineDispatchRepository, softwareActionResultRepository, softwareScheduleService);
    }

    private static SoftwarePackageInput brewPackage() {
        SoftwarePackageInput input = new SoftwarePackageInput();
        input.setPackageManager(PackageManagerType.BREW);
        input.setPackageName("example-app");
        return input;
    }
}
