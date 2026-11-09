package com.openframe.data.service.rmm.software;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.document.rmm.software.PackageMatchState;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.document.rmm.software.SoftwarePackageMatch;
import com.openframe.data.repository.rmm.software.DeviceSoftwareAggregationRepository;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
import com.openframe.data.repository.rmm.software.SoftwareTitleRollup;
import com.openframe.data.service.rmm.software.matching.InstalledProgram;
import com.openframe.data.service.rmm.software.matching.PackageMatch;
import com.openframe.data.service.rmm.software.matching.SoftwarePackageMatcher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareProjectorTest {

    @Mock private SoftwareRepository softwareRepository;
    @Mock private DeviceSoftwareAggregationRepository aggregationRepository;
    @Mock private SoftwarePackageMatcher packageMatcher;

    @InjectMocks private SoftwareProjector projector;

    @Test
    void project_nullTenantOrTitle_isNoOp() {
        assertThat(projector.project(null, 42L)).isZero();
        assertThat(projector.project("t1", null)).isZero();
        verifyNoInteractions(softwareRepository, aggregationRepository);
    }

    @Test
    void project_noInstalls_deletesAggregate() {
        when(aggregationRepository.rollUpTitle("t1", 42L)).thenReturn(Optional.empty());

        assertThat(projector.project("t1", 42L)).isZero();

        verify(softwareRepository).deleteByTenantIdAndSoftwareTitleId("t1", 42L);
        verify(softwareRepository, never()).save(any());
    }

    @Test
    void project_withInstalls_storesTheRollup() {
        List<Software.Installation> installations = List.of(
                Software.Installation.builder().machineId("m1").versions(List.of("1.0", "2.0")).build(),
                Software.Installation.builder().machineId("m2").versions(List.of("1.5")).build());
        when(aggregationRepository.rollUpTitle("t1", 42L)).thenReturn(Optional.of(rollup()
                .devicesCount(2).name("Google Chrome").source("apps")
                .versions(List.of("1.0", "1.5", "2.0")).cveCount(2).installations(installations).build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(Optional.empty());

        assertThat(projector.project("t1", 42L)).isEqualTo(2);

        ArgumentCaptor<Software> captor = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(captor.capture());
        Software saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo("t1");
        assertThat(saved.getSoftwareTitleId()).isEqualTo(42L);
        assertThat(saved.getName()).isEqualTo("Google Chrome");
        assertThat(saved.getNameLower()).isEqualTo("google chrome");
        assertThat(saved.getSource()).isEqualTo("apps");
        assertThat(saved.getLatestVersion()).isEqualTo("2.0");
        assertThat(saved.getInstallations()).isEqualTo(installations);
        assertThat(saved.getDevicesCount()).isEqualTo(2);
        assertThat(saved.getCveCount()).isEqualTo(2);
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    // versions are compared per numeric segment, not as text: "10.0" sorts before "9.0" as a string
    @Test
    void project_latestVersion_isTheNumericMaximum() {
        when(aggregationRepository.rollUpTitle("t1", 42L)).thenReturn(Optional.of(rollup()
                .name("jq").versions(List.of("10.0", "9.0")).build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(Optional.empty());

        projector.project("t1", 42L);

        ArgumentCaptor<Software> saved = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(saved.capture());
        assertThat(saved.getValue().getLatestVersion()).isEqualTo("10.0");
    }

    @Test
    void project_noVersions_noLatestVersion() {
        when(aggregationRepository.rollUpTitle("t1", 42L)).thenReturn(Optional.of(rollup().versions(List.of()).build()));
        lenient().when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(Optional.empty());

        projector.project("t1", 42L);

        ArgumentCaptor<Software> saved = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(saved.capture());
        assertThat(saved.getValue().getLatestVersion()).isNull();
    }

    @Test
    void project_windowsProgram_storesItsKeysAndTheMatch() {
        when(aggregationRepository.rollUpTitle("t1", 7L)).thenReturn(Optional.of(rollup()
                .name("Google Chrome").source("programs").vendor("Google LLC").upgradeCode("{UPGRADE}")
                .arpKeys(List.of("Google Chrome", "{8A69D345-D564-463C-AFF1-A69D9E530F96}"))
                .packageFamilyNames(List.of("google.chrome_x")).installerTypes(List.of("exe", "msi"))
                .systemComponent(false).build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 7L)).thenReturn(Optional.empty());
        PackageCatalogEntry chrome = PackageCatalogEntry.builder()
                .manager(PackageManagerType.WINGET).packageId("Google.Chrome").version("130.0").build();
        List<InstalledProgram> asked = stubMatch(PackageMatch.of(chrome));

        projector.project("t1", 7L);

        InstalledProgram program = asked.getFirst();
        assertThat(program.getFleetSource()).isEqualTo(FleetSource.PROGRAMS);
        assertThat(program.getName()).isEqualTo("Google Chrome");
        assertThat(program.getPublisher()).isEqualTo("Google LLC");
        assertThat(program.getUpgradeCode()).isEqualTo("{UPGRADE}");
        assertThat(program.getProductCodes())
                .containsExactly("Google Chrome", "{8A69D345-D564-463C-AFF1-A69D9E530F96}");
        assertThat(program.getPackageFamilyNames()).containsExactly("google.chrome_x");
        assertThat(program.isSystemComponent()).isFalse();
        ArgumentCaptor<Software> captor = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(captor.capture());
        Software saved = captor.getValue();
        assertThat(saved.getVendor()).isEqualTo("Google LLC");
        assertThat(saved.getUpgradeCode()).isEqualTo("{UPGRADE}");
        assertThat(saved.getArpKeys()).containsExactly("Google Chrome", "{8A69D345-D564-463C-AFF1-A69D9E530F96}");
        assertThat(saved.getPackageFamilyNames()).containsExactly("google.chrome_x");
        assertThat(saved.getInstallerTypes()).containsExactly("exe", "msi");
        assertThat(saved.getSystemComponent()).isFalse();
        assertThat(saved.getPackageMatch().getState()).isEqualTo(PackageMatchState.MATCHED);
        assertThat(saved.getPackageMatch().getManager()).isEqualTo(PackageManagerType.WINGET);
        assertThat(saved.getPackageMatch().getPackageId()).isEqualTo("Google.Chrome");
        assertThat(saved.getPackageMatch().getMatchedAt()).isNotNull();
    }

    @Test
    void project_systemComponent_isStored() {
        when(aggregationRepository.rollUpTitle("t1", 7L)).thenReturn(Optional.of(rollup().systemComponent(true).build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 7L)).thenReturn(Optional.empty());
        List<InstalledProgram> asked = stubMatch(PackageMatch.noPackage());

        projector.project("t1", 7L);

        assertThat(asked.getFirst().isSystemComponent()).isTrue();
        ArgumentCaptor<Software> captor = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(captor.capture());
        assertThat(captor.getValue().getSystemComponent()).isTrue();
    }

    @Test
    void project_noMatcherForTheSource_noStoredMatch() {
        when(aggregationRepository.rollUpTitle("t1", 8L)).thenReturn(Optional.of(rollup().name("Slack").build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 8L)).thenReturn(Optional.empty());
        when(packageMatcher.match(anyList())).thenReturn(Map.of());

        projector.project("t1", 8L);

        ArgumentCaptor<Software> captor = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(captor.capture());
        assertThat(captor.getValue().getPackageMatch()).isNull();
        assertThat(captor.getValue().getArpKeys()).isEmpty();
        assertThat(captor.getValue().getSystemComponent()).isFalse();
    }

    @Test
    void project_sameKeysAndFreshMatch_keepsTheStoredMatchWithoutAsking() {
        Software stored = chromeProjected(Instant.now().minus(Duration.ofHours(1)));
        when(aggregationRepository.rollUpTitle("t1", 7L)).thenReturn(Optional.of(chromeRollup().build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 7L)).thenReturn(Optional.of(stored));

        projector.project("t1", 7L);

        verifyNoInteractions(packageMatcher);
        ArgumentCaptor<Software> captor = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(captor.capture());
        assertThat(captor.getValue().getPackageMatch()).isSameAs(stored.getPackageMatch());
    }

    @Test
    void project_sameKeysButStaleMatch_matchesAgain() {
        Software stored = chromeProjected(Instant.now().minus(SoftwareProjector.MATCH_TTL).minus(Duration.ofMinutes(1)));
        when(aggregationRepository.rollUpTitle("t1", 7L)).thenReturn(Optional.of(chromeRollup().build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 7L)).thenReturn(Optional.of(stored));
        stubMatch(PackageMatch.noPackage());

        projector.project("t1", 7L);

        ArgumentCaptor<Software> captor = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(captor.capture());
        assertThat(captor.getValue().getPackageMatch().getState()).isEqualTo(PackageMatchState.NO_PACKAGE);
    }

    @Test
    void project_keyChanged_matchesAgain() {
        Software stored = chromeProjected(Instant.now());
        when(aggregationRepository.rollUpTitle("t1", 7L)).thenReturn(Optional.of(chromeRollup()
                .arpKeys(List.of("{8A69D345-D564-463C-AFF1-A69D9E530F96}")).build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 7L)).thenReturn(Optional.of(stored));
        List<InstalledProgram> asked = stubMatch(PackageMatch.ambiguous());

        projector.project("t1", 7L);

        assertThat(asked.getFirst().getProductCodes()).containsExactly("{8A69D345-D564-463C-AFF1-A69D9E530F96}");
        ArgumentCaptor<Software> captor = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(captor.capture());
        assertThat(captor.getValue().getPackageMatch().getState()).isEqualTo(PackageMatchState.AMBIGUOUS);
    }

    private static RollupBuilder chromeRollup() {
        return rollup().name("Google Chrome").source("programs").vendor("Google LLC")
                .versions(List.of("130.0")).arpKeys(List.of("Google Chrome")).systemComponent(false);
    }

    // what the projector stored for chromeRollup earlier: same keys, matched at the given time
    private static Software chromeProjected(Instant matchedAt) {
        return Software.builder().tenantId("t1").softwareTitleId(7L).name("Google Chrome").source("programs")
                .vendor("Google LLC").arpKeys(List.of("Google Chrome")).packageFamilyNames(List.of()).systemComponent(false)
                .packageMatch(new SoftwarePackageMatch(PackageMatchState.MATCHED, PackageManagerType.WINGET, "Google.Chrome", matchedAt))
                .build();
    }

    // the matcher answers the first program asked with the given match and hands back what was asked
    private List<InstalledProgram> stubMatch(PackageMatch match) {
        List<InstalledProgram> asked = new ArrayList<>();
        when(packageMatcher.match(anyList())).thenAnswer(invocation -> {
            List<InstalledProgram> programs = invocation.getArgument(0);
            asked.addAll(programs);
            Map<InstalledProgram, PackageMatch> matches = new IdentityHashMap<>();
            matches.put(programs.getFirst(), match);
            return matches;
        });
        return asked;
    }

    private static RollupBuilder rollup() {
        return new RollupBuilder();
    }

    private static final class RollupBuilder {
        private int devicesCount = 1;
        private String name = "App";
        private String source = "apps";
        private String vendor;
        private String upgradeCode;
        private List<String> versions = List.of("1.0");
        private int cveCount;
        private List<String> arpKeys = List.of();
        private List<String> packageFamilyNames = List.of();
        private List<String> installerTypes = List.of();
        private boolean systemComponent;
        private List<Software.Installation> installations = List.of();

        RollupBuilder devicesCount(int value) { devicesCount = value; return this; }
        RollupBuilder name(String value) { name = value; return this; }
        RollupBuilder source(String value) { source = value; return this; }
        RollupBuilder vendor(String value) { vendor = value; return this; }
        RollupBuilder upgradeCode(String value) { upgradeCode = value; return this; }
        RollupBuilder versions(List<String> value) { versions = value; return this; }
        RollupBuilder cveCount(int value) { cveCount = value; return this; }
        RollupBuilder arpKeys(List<String> value) { arpKeys = value; return this; }
        RollupBuilder packageFamilyNames(List<String> value) { packageFamilyNames = value; return this; }
        RollupBuilder installerTypes(List<String> value) { installerTypes = value; return this; }
        RollupBuilder systemComponent(boolean value) { systemComponent = value; return this; }
        RollupBuilder installations(List<Software.Installation> value) { installations = value; return this; }

        SoftwareTitleRollup build() {
            return new SoftwareTitleRollup(devicesCount, name, source, vendor, upgradeCode, versions, cveCount,
                    arpKeys, packageFamilyNames, installerTypes, systemComponent, installations);
        }
    }
}
