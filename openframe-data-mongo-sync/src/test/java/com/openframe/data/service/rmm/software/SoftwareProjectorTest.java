package com.openframe.data.service.rmm.software;

import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageMatchState;
import com.openframe.data.service.rmm.software.matching.InstalledProgram;
import com.openframe.data.service.rmm.software.matching.PackageMatch;
import com.openframe.data.service.rmm.software.matching.SoftwarePackageMatcher;
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
    @Mock private SoftwarePackageMatcher packageMatcher;

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
                DeviceSoftware.builder().machineId("m1")
                        .versions(List.of("1.0", "2.0")).vulnerabilities(List.of("CVE-1", "CVE-2"))
                        .name("Google Chrome").source("apps").build(),
                DeviceSoftware.builder().machineId("m2")
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

    // versions are compared per numeric segment, not as text: "10.0" sorts before "9.0" as a string
    @Test
    void project_latestVersion_isTheNumericMaximum() {
        when(deviceSoftwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m1").versions(List.of("9.0")).name("jq").source("apps").build(),
                DeviceSoftware.builder().machineId("m2").versions(List.of("10.0")).name("jq").source("apps").build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(Optional.empty());

        projector.project("t1", 42L);

        ArgumentCaptor<Software> saved = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(saved.capture());
        assertThat(saved.getValue().getLatestVersion()).isEqualTo("10.0");
    }

    @Test
    void project_windowsProgram_storesTheUnionOfItsKeysAndTheMatch() {
        when(deviceSoftwareRepository.findByTenantIdAndSoftwareTitleId("t1", 7L)).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m1").name("Google Chrome").source("programs")
                        .versions(List.of("130.0")).vendor("Google LLC").upgradeCode(null)
                        .arpKeys(List.of("Google Chrome")).installerTypes(List.of("exe")).systemComponent(false).build(),
                DeviceSoftware.builder().machineId("m2").name("Google Chrome").source("programs")
                        .versions(List.of("129.0")).vendor("Google LLC")
                        .arpKeys(List.of("{8A69D345-D564-463C-AFF1-A69D9E530F96}")).installerTypes(List.of("msi"))
                        .systemComponent(null).build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 7L)).thenReturn(Optional.empty());
        PackageCatalogEntry chrome = PackageCatalogEntry.builder()
                .manager(PackageManagerType.WINGET).packageId("Google.Chrome").version("130.0").build();
        ArgumentCaptor<InstalledProgram> program = ArgumentCaptor.forClass(InstalledProgram.class);
        when(packageMatcher.match(program.capture())).thenReturn(Optional.of(PackageMatch.of(chrome)));

        projector.project("t1", 7L);

        assertThat(program.getValue().getFleetSource()).isEqualTo(FleetSource.PROGRAMS);
        assertThat(program.getValue().getPublisher()).isEqualTo("Google LLC");
        assertThat(program.getValue().getProductCodes())
                .containsExactly("Google Chrome", "{8A69D345-D564-463C-AFF1-A69D9E530F96}");
        assertThat(program.getValue().isSystemComponent()).isFalse();
        ArgumentCaptor<Software> captor = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(captor.capture());
        Software saved = captor.getValue();
        assertThat(saved.getVendor()).isEqualTo("Google LLC");
        assertThat(saved.getArpKeys()).containsExactly("Google Chrome", "{8A69D345-D564-463C-AFF1-A69D9E530F96}");
        assertThat(saved.getInstallerTypes()).containsExactly("exe", "msi");
        assertThat(saved.getSystemComponent()).isFalse();
        assertThat(saved.getPackageMatch().getState()).isEqualTo(PackageMatchState.MATCHED);
        assertThat(saved.getPackageMatch().getManager()).isEqualTo(PackageManagerType.WINGET);
        assertThat(saved.getPackageMatch().getPackageId()).isEqualTo("Google.Chrome");
    }

    @Test
    void project_noMatcherForTheSource_noStoredMatch() {
        when(deviceSoftwareRepository.findByTenantIdAndSoftwareTitleId("t1", 8L)).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m1").name("Slack").source("apps").versions(List.of("4.0")).build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 8L)).thenReturn(Optional.empty());
        when(packageMatcher.match(any(InstalledProgram.class))).thenReturn(Optional.empty());

        projector.project("t1", 8L);

        ArgumentCaptor<Software> captor = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(captor.capture());
        assertThat(captor.getValue().getPackageMatch()).isNull();
        assertThat(captor.getValue().getArpKeys()).isEmpty();
    }
}
