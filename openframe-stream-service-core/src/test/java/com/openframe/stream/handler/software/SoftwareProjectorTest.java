package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.FleetSoftwareTitle;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.FleetSoftwareTitleRepository;
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
    @Mock private DeviceCveRepository deviceCveRepository;
    @Mock private FleetSoftwareTitleRepository fleetSoftwareTitleRepository;

    @InjectMocks private SoftwareProjector projector;

    @Test
    void project_nullTenantOrTitle_isNoOp() {
        projector.project(null, 42L);
        projector.project("t1", null);
        verifyNoInteractions(softwareRepository, deviceSoftwareRepository, deviceCveRepository);
    }

    @Test
    void project_noInstalls_deletesAggregate() {
        when(deviceSoftwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(List.of());

        projector.project("t1", 42L);

        verify(softwareRepository).deleteByTenantIdAndSoftwareTitleId("t1", 42L);
        verify(softwareRepository, never()).save(any());
        verifyNoInteractions(deviceCveRepository);
    }

    @Test
    void project_withInstalls_buildsAggregateWithCatalogAndDistinctDevices() {
        when(deviceSoftwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m1").hostId(100L).softwareId(200L)
                        .version("1.0").name("chrome").source("apps").build(),
                DeviceSoftware.builder().machineId("m1").hostId(100L).softwareId(201L)
                        .version("2.0").name("chrome").source("apps").build(),   // same machine, newer version
                DeviceSoftware.builder().machineId("m2").hostId(101L).softwareId(202L)
                        .version("1.5").name("chrome").source("apps").build()));
        when(deviceCveRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(List.of(
                DeviceCve.builder().cveId("CVE-1").build(),
                DeviceCve.builder().cveId("CVE-1").build(),   // duplicate across machines
                DeviceCve.builder().cveId("CVE-2").build()));
        when(fleetSoftwareTitleRepository.findBySoftwareTitleId(42L)).thenReturn(Optional.of(
                FleetSoftwareTitle.builder().softwareTitleId(42L).name("Google Chrome")
                        .nameLower("google chrome").source("apps").browser("").build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(Optional.empty());

        projector.project("t1", 42L);

        ArgumentCaptor<Software> captor = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(captor.capture());
        Software saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo("t1");
        assertThat(saved.getSoftwareTitleId()).isEqualTo(42L);
        assertThat(saved.getName()).isEqualTo("Google Chrome");          // catalog overrides edge
        assertThat(saved.getNameLower()).isEqualTo("google chrome");
        assertThat(saved.getLatestVersion()).isEqualTo("2.0");
        assertThat(saved.getInstallations()).hasSize(3);
        assertThat(saved.getDevicesCount()).isEqualTo(2);                 // m1, m2 distinct
        assertThat(saved.getCveIds()).containsExactlyInAnyOrder("CVE-1", "CVE-2");
        assertThat(saved.getCveCount()).isEqualTo(2);
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    void project_withInstallsButNoCatalog_fallsBackToEdgeName() {
        when(deviceSoftwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m1").softwareId(200L).version("1.0")
                        .name("Custom App").source("programs").build()));
        when(deviceCveRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(List.of());
        when(fleetSoftwareTitleRepository.findBySoftwareTitleId(42L)).thenReturn(Optional.empty());
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
