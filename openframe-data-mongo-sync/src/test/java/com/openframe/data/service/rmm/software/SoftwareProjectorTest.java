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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
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
import java.util.stream.Stream;

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

    @Captor private ArgumentCaptor<Software> softwareCaptor;

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
        when(aggregationRepository.rollUpTitle("t1", 42L)).thenReturn(Optional.of(rollup()
                .devicesCount(2).name("Google Chrome").source("apps")
                .versions(List.of("1.0", "1.5", "2.0")).cveCount(2).build()));
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
        assertThat(saved.getDevicesCount()).isEqualTo(2);
        assertThat(saved.getCveCount()).isEqualTo(2);
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

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
    void project_currentVersion_isOnTheMostDevices_olderVersionsAreTheRest() {
        when(aggregationRepository.rollUpTitle("t1", 42L)).thenReturn(Optional.of(rollup()
                .devicesByVersion(Map.of("1.6", 1, "1.7", 2, "1.5", 1)).build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(Optional.empty());

        projector.project("t1", 42L);

        ArgumentCaptor<Software> saved = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(saved.capture());
        assertThat(saved.getValue().getCurrentVersion()).isEqualTo("1.7");
        assertThat(saved.getValue().getOlderVersionsCount()).isEqualTo(2);
    }

    @Test
    void project_currentVersion_tieGoesToTheNewerVersion() {
        when(aggregationRepository.rollUpTitle("t1", 42L)).thenReturn(Optional.of(rollup()
                .devicesByVersion(Map.of("9.0", 2, "10.0", 2)).build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(Optional.empty());

        projector.project("t1", 42L);

        ArgumentCaptor<Software> saved = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(saved.capture());
        assertThat(saved.getValue().getCurrentVersion()).isEqualTo("10.0");
        assertThat(saved.getValue().getOlderVersionsCount()).isEqualTo(1);
    }

    @Test
    void project_noVersionCounts_noCurrentVersionAndNoOlderVersions() {
        when(aggregationRepository.rollUpTitle("t1", 42L)).thenReturn(Optional.of(rollup().devicesByVersion(Map.of()).build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(Optional.empty());

        projector.project("t1", 42L);

        ArgumentCaptor<Software> saved = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(saved.capture());
        assertThat(saved.getValue().getCurrentVersion()).isNull();
        assertThat(saved.getValue().getOlderVersionsCount()).isZero();
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
    void project_packageWingetInstalled_matchedByTheIdsOfItsDevices() {
        when(aggregationRepository.rollUpTitle("t1", 9L)).thenReturn(Optional.of(rollup()
                .name("Google Chrome").source("winget_packages").wingetIds(List.of("Google.Chrome")).build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 9L)).thenReturn(Optional.empty());
        PackageCatalogEntry chrome = PackageCatalogEntry.builder()
                .manager(PackageManagerType.WINGET).packageId("Google.Chrome").version("130.0").build();
        List<InstalledProgram> asked = stubMatch(PackageMatch.of(chrome));

        projector.project("t1", 9L);

        InstalledProgram program = asked.getFirst();
        assertThat(program.getFleetSource()).isEqualTo(FleetSource.WINGET_PACKAGES);
        assertThat(program.getWingetIds()).containsExactly("Google.Chrome");
        ArgumentCaptor<Software> captor = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(captor.capture());
        Software saved = captor.getValue();
        assertThat(saved.getWingetIds()).containsExactly("Google.Chrome");
        assertThat(saved.getPackageMatch().getState()).isEqualTo(PackageMatchState.MATCHED);
        assertThat(saved.getPackageMatch().getPackageId()).isEqualTo("Google.Chrome");
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
    void project_windowsProgram_storesThePackageToAdoptItInto() {
        // setup
        PackageCatalogEntry choco7zip = PackageCatalogEntry.builder().manager(PackageManagerType.CHOCO).packageId("7zip").build();
        when(aggregationRepository.rollUpTitle("t1", 7L)).thenReturn(Optional.of(chromeRollup().build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 7L)).thenReturn(Optional.empty());
        stubMatch(PackageMatch.noPackage());
        when(packageMatcher.matchForAdoption(anyList())).thenAnswer(invocation -> {
            List<InstalledProgram> programs = invocation.getArgument(0);
            Map<InstalledProgram, PackageMatch> matches = new IdentityHashMap<>();
            matches.put(programs.getFirst(), PackageMatch.of(choco7zip));
            return matches;
        });

        // execution
        projector.project("t1", 7L);

        // verifications
        ArgumentCaptor<Software> captor = ArgumentCaptor.forClass(Software.class);
        verify(softwareRepository).save(captor.capture());
        Software saved = captor.getValue();
        assertThat(saved.getPackageMatch().getState()).isEqualTo(PackageMatchState.NO_PACKAGE);
        assertThat(saved.getAdoptionMatch().getState()).isEqualTo(PackageMatchState.MATCHED);
        assertThat(saved.getAdoptionMatch().getManager()).isEqualTo(PackageManagerType.CHOCO);
        assertThat(saved.getAdoptionMatch().getPackageId()).isEqualTo("7zip");
        assertThat(saved.getAdoptionMatch().getMatchedAt()).isEqualTo(saved.getPackageMatch().getMatchedAt());
    }

    @Test
    void project_onlyTheAdoptionMatchIsFresh_keepsBothWithoutAsking() {
        // setup
        Instant fresh = Instant.now().minus(Duration.ofHours(1));
        Software stored = chromeProjected(null);
        stored.setPackageMatch(null);
        stored.setAdoptionMatch(new SoftwarePackageMatch(PackageMatchState.MATCHED, PackageManagerType.CHOCO, "googlechrome", fresh));
        when(aggregationRepository.rollUpTitle("t1", 7L)).thenReturn(Optional.of(chromeRollup().build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 7L)).thenReturn(Optional.of(stored));

        // execution
        projector.project("t1", 7L);

        // verifications
        verifyNoInteractions(packageMatcher);
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

    @Test
    void project_wingetIdsOfTheDevicesChanged_matchesAgain() {
        Software stored = chromeProjected(Instant.now());
        when(aggregationRepository.rollUpTitle("t1", 7L)).thenReturn(Optional.of(chromeRollup()
                .wingetIds(List.of("Google.Chrome")).build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 7L)).thenReturn(Optional.of(stored));
        List<InstalledProgram> asked = stubMatch(PackageMatch.noPackage());

        projector.project("t1", 7L);

        assertThat(asked.getFirst().getWingetIds()).containsExactly("Google.Chrome");
    }

    @Test
    void project_macApp_storesItsKeysAndAsksTheMatcherWithThem() {
        // setup
        SoftwareTitleRollup slack = slackRollup().build();
        when(aggregationRepository.rollUpTitle("t1", 8L)).thenReturn(Optional.of(slack));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 8L)).thenReturn(Optional.empty());
        List<InstalledProgram> asked = stubMatch(PackageMatch.noPackage());

        // execution
        projector.project("t1", 8L);

        // verifications
        InstalledProgram program = asked.getFirst();
        assertThat(program.getFleetSource()).isEqualTo(FleetSource.APPS);
        assertThat(program.getBundleIdentifier()).isEqualTo("com.tinyspeck.slackmacgap");
        assertThat(program.getAppFileNames()).containsExactly("Slack");
        assertThat(program.getTopLevelApp()).isTrue();
        verify(softwareRepository).save(softwareCaptor.capture());
        Software saved = softwareCaptor.getValue();
        assertThat(saved.getBundleIdentifier()).isEqualTo("com.tinyspeck.slackmacgap");
        assertThat(saved.getAppFileNames()).containsExactly("Slack");
        assertThat(saved.getTopLevelApp()).isTrue();
    }

    @Test
    void project_programWithoutAppKeys_storesNoneAndAsksTheMatcherWithNone() {
        // setup
        SoftwareTitleRollup chrome = chromeRollup().build();
        when(aggregationRepository.rollUpTitle("t1", 7L)).thenReturn(Optional.of(chrome));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 7L)).thenReturn(Optional.empty());
        List<InstalledProgram> asked = stubMatch(PackageMatch.noPackage());

        // execution
        projector.project("t1", 7L);

        // verifications
        InstalledProgram program = asked.getFirst();
        assertThat(program.getBundleIdentifier()).isNull();
        assertThat(program.getAppFileNames()).isEmpty();
        assertThat(program.getTopLevelApp()).isNull();
        verify(softwareRepository).save(softwareCaptor.capture());
        Software saved = softwareCaptor.getValue();
        assertThat(saved.getBundleIdentifier()).isNull();
        assertThat(saved.getAppFileNames()).isEmpty();
        assertThat(saved.getTopLevelApp()).isNull();
    }

    @Test
    void project_macAppWithTheSameKeysAndAFreshMatch_keepsTheStoredMatchWithoutAsking() {
        // setup
        Instant fresh = Instant.now().minus(Duration.ofHours(1));
        Software stored = slackProjected(fresh);
        SoftwareTitleRollup slack = slackRollup().build();
        when(aggregationRepository.rollUpTitle("t1", 8L)).thenReturn(Optional.of(slack));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 8L)).thenReturn(Optional.of(stored));

        // execution
        projector.project("t1", 8L);

        // verifications
        verifyNoInteractions(packageMatcher);
    }

    @ParameterizedTest
    @MethodSource("slackRollupsWithAChangedAppKey")
    void project_appKeyOfAMacAppChanged_matchesAgain(SoftwareTitleRollup changed) {
        // setup
        Software stored = slackProjected(Instant.now());
        when(aggregationRepository.rollUpTitle("t1", 8L)).thenReturn(Optional.of(changed));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 8L)).thenReturn(Optional.of(stored));
        List<InstalledProgram> asked = stubMatch(PackageMatch.noPackage());

        // execution
        projector.project("t1", 8L);

        // verifications
        assertThat(asked).hasSize(1);
        verify(softwareRepository).save(softwareCaptor.capture());
        Software saved = softwareCaptor.getValue();
        assertThat(saved.getBundleIdentifier()).isEqualTo(changed.bundleIdentifier());
        assertThat(saved.getAppFileNames()).isEqualTo(changed.appFileNames());
        assertThat(saved.getTopLevelApp()).isEqualTo(changed.topLevelApp());
    }

    @Test
    void project_titleWithoutAName_isNamedByItsWingetId() {
        // setup
        SoftwareTitleRollup nameless = rollup().name(null).source("programs").wingetIds(List.of("Contoso.Agent"))
                .appFileNames(List.of("Contoso Agent")).packageFamilyNames(List.of("Contoso.Agent_8wekyb3d8bbwe")).build();
        stubFirstProjection(nameless);

        // execution
        projector.project("t1", 9L);

        // verifications
        Software saved = savedSoftware();
        assertThat(saved.getName()).isEqualTo("Contoso.Agent");
        assertThat(saved.getNameLower()).isEqualTo("contoso.agent");
    }

    @Test
    void project_titleWithoutANameOrWingetId_isNamedByItsAppFileName() {
        // setup
        SoftwareTitleRollup nameless = rollup().name(null).appFileNames(List.of("Contoso Agent"))
                .packageFamilyNames(List.of("Contoso.Agent_8wekyb3d8bbwe")).build();
        stubFirstProjection(nameless);

        // execution
        projector.project("t1", 9L);

        // verifications
        assertThat(savedSoftware().getName()).isEqualTo("Contoso Agent");
    }

    @Test
    void project_titleWithOnlyAPackageFamilyName_isNamedByIt() {
        // setup
        SoftwareTitleRollup nameless = rollup().name(null).source("programs")
                .packageFamilyNames(List.of("Contoso.Agent_8wekyb3d8bbwe")).build();
        stubFirstProjection(nameless);

        // execution
        projector.project("t1", 9L);

        // verifications
        assertThat(savedSoftware().getName()).isEqualTo("Contoso.Agent_8wekyb3d8bbwe");
    }

    @Test
    void project_titleWithNothingToNameItBy_staysNameless() {
        // setup
        SoftwareTitleRollup nameless = rollup().name(null).build();
        stubFirstProjection(nameless);

        // execution
        projector.project("t1", 9L);

        // verifications
        Software saved = savedSoftware();
        assertThat(saved.getName()).isNull();
        assertThat(saved.getNameLower()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"${{arpDisplayName}}", "{8A69D345-D564-463C-AFF1-A69D9E530F96}"})
    void project_placeholderOrGuidOnlyName_isNamedByItsWingetId(String placeholder) {
        // setup
        SoftwareTitleRollup placeholderNamed = rollup().name(placeholder).source("programs")
                .wingetIds(List.of("Contoso.Agent")).build();
        stubFirstProjection(placeholderNamed);

        // execution
        projector.project("t1", 9L);

        // verifications
        assertThat(savedSoftware().getName()).isEqualTo("Contoso.Agent");
    }

    @Test
    void project_placeholderName_isNotGivenToTheMatcher() {
        // setup
        SoftwareTitleRollup placeholderNamed = rollup().name("${{arpDisplayName}}").source("programs")
                .wingetIds(List.of("Contoso.Agent")).build();
        when(aggregationRepository.rollUpTitle("t1", 9L)).thenReturn(Optional.of(placeholderNamed));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 9L)).thenReturn(Optional.empty());
        List<InstalledProgram> asked = stubMatch(PackageMatch.noPackage());

        // execution
        projector.project("t1", 9L);

        // verifications
        assertThat(asked.getFirst().getName()).isNull();
        assertThat(asked.getFirst().getWingetIds()).containsExactly("Contoso.Agent");
    }

    @Test
    void project_titleNamedByItsWingetIdWithTheSameKeysAndAFreshMatch_keepsTheStoredMatchWithoutAsking() {
        // setup
        SoftwareTitleRollup nameless = rollup().name(null).source("programs").wingetIds(List.of("Contoso.Agent")).build();
        Software stored = Software.builder().tenantId("t1").softwareTitleId(9L).name("Contoso.Agent").source("programs")
                .arpKeys(List.of()).packageFamilyNames(List.of()).wingetIds(List.of("Contoso.Agent"))
                .appFileNames(List.of()).systemComponent(false)
                .packageMatch(new SoftwarePackageMatch(PackageMatchState.NO_PACKAGE, null, null, Instant.now()))
                .build();
        when(aggregationRepository.rollUpTitle("t1", 9L)).thenReturn(Optional.of(nameless));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 9L)).thenReturn(Optional.of(stored));

        // execution
        projector.project("t1", 9L);

        // verifications
        verifyNoInteractions(packageMatcher);
    }

    private void stubFirstProjection(SoftwareTitleRollup rollup) {
        when(aggregationRepository.rollUpTitle("t1", 9L)).thenReturn(Optional.of(rollup));
        when(softwareRepository.findByTenantIdAndSoftwareTitleId("t1", 9L)).thenReturn(Optional.empty());
    }

    private Software savedSoftware() {
        verify(softwareRepository).save(softwareCaptor.capture());
        return softwareCaptor.getValue();
    }

    private static Stream<SoftwareTitleRollup> slackRollupsWithAChangedAppKey() {
        return Stream.of(
                slackRollup().bundleIdentifier("com.tinyspeck.slackmacgap.beta").build(),
                slackRollup().appFileNames(List.of("Slack", "Slack Beta")).build(),
                slackRollup().topLevelApp(false).build(),
                slackRollup().topLevelApp(null).build());
    }

    private static RollupBuilder slackRollup() {
        return rollup().name("Slack").source("apps").bundleIdentifier("com.tinyspeck.slackmacgap")
                .appFileNames(List.of("Slack")).topLevelApp(true);
    }

    private static Software slackProjected(Instant matchedAt) {
        return Software.builder().tenantId("t1").softwareTitleId(8L).name("Slack").source("apps")
                .arpKeys(List.of()).packageFamilyNames(List.of()).systemComponent(false)
                .bundleIdentifier("com.tinyspeck.slackmacgap").appFileNames(List.of("Slack")).topLevelApp(true)
                .packageMatch(new SoftwarePackageMatch(PackageMatchState.NO_PACKAGE, null, null, matchedAt))
                .build();
    }

    private static RollupBuilder chromeRollup() {
        return rollup().name("Google Chrome").source("programs").vendor("Google LLC")
                .versions(List.of("130.0")).arpKeys(List.of("Google Chrome")).systemComponent(false);
    }

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
        private List<String> wingetIds = List.of();
        private String bundleIdentifier;
        private List<String> appFileNames = List.of();
        private Boolean topLevelApp;
        private boolean systemComponent;
        private Map<String, Integer> devicesByVersion = Map.of("1.0", 1);

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
        RollupBuilder wingetIds(List<String> value) { wingetIds = value; return this; }
        RollupBuilder bundleIdentifier(String value) { bundleIdentifier = value; return this; }
        RollupBuilder appFileNames(List<String> value) { appFileNames = value; return this; }
        RollupBuilder topLevelApp(Boolean value) { topLevelApp = value; return this; }
        RollupBuilder systemComponent(boolean value) { systemComponent = value; return this; }
        RollupBuilder devicesByVersion(Map<String, Integer> value) { devicesByVersion = value; return this; }

        SoftwareTitleRollup build() {
            return new SoftwareTitleRollup(devicesCount, name, source, vendor, upgradeCode, versions, cveCount,
                    arpKeys, packageFamilyNames, installerTypes, wingetIds, bundleIdentifier, appFileNames,
                    topLevelApp, systemComponent, devicesByVersion);
        }
    }
}
