package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.repository.rmm.PackageAutoUpdatePolicyRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareAutoUpdateServiceTest {

    private static final String TENANT = "t1";

    @Mock private PackageAutoUpdatePolicyRepository policyRepository;
    @Mock private TenantIdProvider tenantIdProvider;

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
    void turnOff_disablesTheSoftwaresPolicies() {
        service.turnOff("chrome", "admin@x");

        verify(policyRepository).disableBySoftwareId(TENANT, "chrome", "admin@x");
    }

    private static PackageAutoUpdatePolicy policy(String machineId, String softwareId, boolean enabled) {
        return PackageAutoUpdatePolicy.builder()
                .tenantId(TENANT).machineId(machineId).softwareId(softwareId).enabled(enabled).build();
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
