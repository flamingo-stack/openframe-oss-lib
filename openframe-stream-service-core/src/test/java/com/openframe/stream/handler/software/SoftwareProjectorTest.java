package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareProjectorTest {

    @Mock private SoftwareRepository softwareRepository;
    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;

    @InjectMocks private SoftwareProjector projector;

    @Test
    void project_nullTenantOrTitle_isNoOp() {
        projector.project(null, 42L);
        projector.project("t1", null);
        verifyNoInteractions(softwareRepository, deviceSoftwareRepository);
    }

    @Test
    void project_noInstalls_deletesAggregate() {
        when(deviceSoftwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(List.of());

        projector.project("t1", 42L);

        verify(softwareRepository).deleteByTenantIdAndSoftwareTitleId("t1", 42L);
        verify(softwareRepository, never()).save(any());
    }

    @Test
    void project_withInstalls_buildsAggregateFromEdgesWithDistinctDevices() {
        when(deviceSoftwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m1").hostId(100L)
                        .versions(List.of("1.0", "2.0")).vulnerabilities(List.of("CVE-1", "CVE-2"))
                        .name("Google Chrome").source("apps").build(),
                DeviceSoftware.builder().machineId("m2").hostId(101L)
                        .versions(List.of("1.5")).vulnerabilities(List.of("CVE-1"))  // duplicate across machines
                        .name("Google Chrome").source("apps").build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(Optional.empty());

        projector.project("t1", 42L);

        ArgumentCaptor<Software> captor = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(captor.capture());
        Software saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo("t1");
        assertThat(saved.getSoftwareTitleId()).isEqualTo(42L);
        assertThat(saved.getName()).isEqualTo("Google Chrome");          // from the device edge
        assertThat(saved.getNameLower()).isEqualTo("google chrome");
        assertThat(saved.getSource()).isEqualTo("apps");
        assertThat(saved.getLatestVersion()).isEqualTo("2.0");           // max across all installed versions
        assertThat(saved.getInstallations()).hasSize(2);
        assertThat(saved.getInstallations().get(0).getVersions()).containsExactly("1.0", "2.0");
        assertThat(saved.getDevicesCount()).isEqualTo(2);                // m1, m2 distinct
        assertThat(saved.getCveIds()).containsExactlyInAnyOrder("CVE-1", "CVE-2");
        assertThat(saved.getCveCount()).isEqualTo(2);
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    void project_withInstallsNoCves_zeroCveCount() {
        when(deviceSoftwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m1").versions(List.of("1.0")).vulnerabilities(List.of())
                        .name("Custom App").source("programs").build()));
        lenient().when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(Optional.empty());

        projector.project("t1", 42L);

        ArgumentCaptor<Software> captor = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(captor.capture());
        Software saved = captor.getValue();
        assertThat(saved.getName()).isEqualTo("Custom App");
        assertThat(saved.getNameLower()).isEqualTo("custom app");
        assertThat(saved.getSource()).isEqualTo("programs");
        assertThat(saved.getCveCount()).isZero();
    }
}
