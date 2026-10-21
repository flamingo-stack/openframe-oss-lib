package com.openframe.api.service.rmm.software;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageUpdateEligibilityServiceTest {

    @Mock private OpenFrameClientConfigurationService clientConfigurationService;
    @Mock private MachineRepository machineRepository;

    @InjectMocks private PackageUpdateEligibilityService service;

    private Machine machine(String id, String agentVersion) {
        Machine m = new Machine();
        m.setMachineId(id);
        m.setAgentVersion(agentVersion);
        return m;
    }

    private void flag(boolean enabled, String minVersion) {
        OpenFrameClientConfiguration config = OpenFrameClientConfiguration.builder()
                .featureFlags(Map.of(PackageUpdateEligibilityService.FLAG,
                        ClientFeatureFlag.builder().enabled(enabled).minVersion(minVersion).build()))
                .build();
        when(clientConfigurationService.get()).thenReturn(config);
    }

    @Test
    void versionAtLeast_rules() {
        assertThat(PackageUpdateEligibilityService.versionAtLeast("1.3.0", "1.2.0")).isTrue();
        assertThat(PackageUpdateEligibilityService.versionAtLeast("1.2.0", "1.2.0")).isTrue();
        assertThat(PackageUpdateEligibilityService.versionAtLeast("1.1.9", "1.2.0")).isFalse();
        assertThat(PackageUpdateEligibilityService.versionAtLeast("2.0", "1.12.0")).isTrue();   // numeric, not lexical
        assertThat(PackageUpdateEligibilityService.versionAtLeast(null, "1.0.0")).isFalse();
        assertThat(PackageUpdateEligibilityService.versionAtLeast("1.0.0", null)).isTrue();     // no floor
        assertThat(PackageUpdateEligibilityService.versionAtLeast("1.0.0", "  ")).isTrue();
    }

    @Test
    void eligibleMachines_emptyInput_isEmpty_noLookups() {
        Set<String> result = service.eligibleMachines(List.of());
        assertThat(result).isEmpty();
        verifyNoInteractions(clientConfigurationService, machineRepository);
    }

    @Test
    void eligibleMachines_flagDisabled_isEmpty() {
        flag(false, "1.0.0");
        assertThat(service.eligibleMachines(List.of("m1"))).isEmpty();
        verifyNoInteractions(machineRepository);
    }

    @Test
    void eligibleMachines_noClientConfiguration_isEmpty() {
        when(clientConfigurationService.get()).thenThrow(new IllegalStateException("No openframe client configuration found"));
        assertThat(service.eligibleMachines(List.of("m1"))).isEmpty();
        verifyNoInteractions(machineRepository);
    }

    @Test
    void eligibleMachines_filtersByMinVersion() {
        flag(true, "1.2.0");
        when(machineRepository.findByMachineIdIn(List.of("m1", "m2", "m3"))).thenReturn(List.of(
                machine("m1", "1.3.0"),   // eligible
                machine("m2", "1.1.0"),   // below floor
                machine("m3", null)));    // no version
        assertThat(service.eligibleMachines(List.of("m1", "m2", "m3"))).containsExactly("m1");
    }

    @Test
    void eligibleMachines_noMinVersion_allWithAgentVersion() {
        flag(true, null);
        lenient().when(machineRepository.findByMachineIdIn(List.of("m1", "m2"))).thenReturn(List.of(
                machine("m1", "0.9.0"),
                machine("m2", "9.9.9")));
        assertThat(service.eligibleMachines(List.of("m1", "m2"))).containsExactlyInAnyOrder("m1", "m2");
    }
}
