package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageMatchState;
import com.openframe.data.document.rmm.software.SoftwarePackageMatch;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwarePackageMatcherTest {

    @Mock private PackageMatcher wingetMatcher;
    @Mock private PackageMatcher chocoMatcher;
    @Mock private PackageCatalogRepository catalogRepository;
    @Mock private BrewCaskIndexCache brewCaskIndexCache;

    @Test
    void match_windowsPrograms_matchedByTheWingetMatcher() {
        // setup
        InstalledProgram chrome = program("Google Chrome", FleetSource.PROGRAMS);
        PackageMatch match = PackageMatch.noPackage();
        when(wingetMatcher.getFleetSource()).thenReturn(FleetSource.PROGRAMS);
        when(wingetMatcher.match(List.of(chrome))).thenReturn(List.of(match));

        // execution
        Map<InstalledProgram, PackageMatch> matches = matcher(wingetMatcher).match(List.of(chrome));

        // verifications
        assertThat(matches).containsEntry(chrome, match);
    }

    @Test
    void match_brewPrograms_matchedByTheBrewMatcher() {
        // setup
        InstalledProgram wget = program("wget", FleetSource.HOMEBREW_PACKAGES);
        PackageMatch match = PackageMatch.noPackage();
        when(wingetMatcher.getFleetSource()).thenReturn(FleetSource.HOMEBREW_PACKAGES);
        when(wingetMatcher.match(List.of(wget))).thenReturn(List.of(match));

        // execution
        Map<InstalledProgram, PackageMatch> matches = matcher(wingetMatcher).match(List.of(wget));

        // verifications
        assertThat(matches).containsEntry(wget, match);
    }

    @Test
    void match_packagesWingetInstalled_matchedByTheMatcherOfThatTable() {
        // setup
        InstalledProgram chrome = program("Google Chrome", FleetSource.WINGET_PACKAGES);
        PackageMatch match = PackageMatch.noPackage();
        when(wingetMatcher.getFleetSource()).thenReturn(FleetSource.WINGET_PACKAGES);
        when(wingetMatcher.match(List.of(chrome))).thenReturn(List.of(match));

        // execution
        Map<InstalledProgram, PackageMatch> matches = matcher(wingetMatcher).match(List.of(chrome));

        // verifications
        assertThat(matches).containsEntry(chrome, match);
    }

    @Test
    void match_programsNoMatcherTakes_leftOut() {
        // setup
        when(wingetMatcher.getFleetSource()).thenReturn(FleetSource.PROGRAMS);
        List<InstalledProgram> programs = List.of(program("Google Chrome", FleetSource.APPS),
                program("googlechrome", FleetSource.CHOCOLATEY_PACKAGES), program("xz", FleetSource.OTHER));

        // execution
        Map<InstalledProgram, PackageMatch> matches = matcher(wingetMatcher).match(programs);

        // verifications
        assertThat(matches).isEmpty();
    }

    @Test
    void match_noMatcherForTheManager_programLeftOut() {
        // setup
        SoftwarePackageMatcher packageMatcher = matcher();

        // execution
        Map<InstalledProgram, PackageMatch> matches = packageMatcher.match(List.of(program("Google Chrome", FleetSource.PROGRAMS)));

        // verifications
        assertThat(matches).isEmpty();
        verifyNoInteractions(wingetMatcher, catalogRepository);
    }

    @Test
    void matchForAdoption_windowsPrograms_matchedByTheAdoptionMatcherOfThatTable() {
        // setup
        InstalledProgram sevenZip = program("7-Zip", FleetSource.PROGRAMS);
        PackageMatch adoption = PackageMatch.of(chocoPackage("7zip"));
        stubAdoptionMatcher();
        when(wingetMatcher.getFleetSource()).thenReturn(FleetSource.PROGRAMS);
        when(chocoMatcher.match(List.of(sevenZip))).thenReturn(List.of(adoption));

        // execution
        Map<InstalledProgram, PackageMatch> matches = matcher(wingetMatcher, chocoMatcher).matchForAdoption(List.of(sevenZip));

        // verifications
        assertThat(matches).containsEntry(sevenZip, adoption);
        verify(wingetMatcher, never()).match(anyList());
    }

    @Test
    void matchForAdoption_severalPackages_theBestCandidateIsTheMatch() {
        // setup
        InstalledProgram vlc = program("VLC media player", FleetSource.PROGRAMS);
        PackageCatalogEntry best = chocoPackage("vlc");
        PackageMatch several = PackageMatch.ambiguous(best);
        stubAdoptionMatcher();
        when(chocoMatcher.match(List.of(vlc))).thenReturn(List.of(several));

        // execution
        PackageMatch match = matcher(chocoMatcher).matchForAdoption(List.of(vlc)).get(vlc);

        // verifications
        assertThat(match.isMatched()).isTrue();
        assertThat(match.getEntry()).isSameAs(best);
    }

    @Test
    void match_severalPackages_staysAmbiguousWhateverTheBestCandidate() {
        // setup
        InstalledProgram vlc = program("VLC media player", FleetSource.PROGRAMS);
        PackageCatalogEntry best = wingetPackage("VideoLAN.VLC");
        PackageMatch several = PackageMatch.ambiguous(best);
        when(wingetMatcher.getFleetSource()).thenReturn(FleetSource.PROGRAMS);
        when(wingetMatcher.match(List.of(vlc))).thenReturn(List.of(several));

        // execution
        PackageMatch match = matcher(wingetMatcher).match(List.of(vlc)).get(vlc);

        // verifications
        assertThat(match.isMatched()).isFalse();
        assertThat(match.hasNoPackage()).isFalse();
    }

    @Test
    void match_adoptionMatcherOfTheSameTable_notAsked() {
        // setup
        InstalledProgram sevenZip = program("7-Zip", FleetSource.PROGRAMS);
        PackageMatch match = PackageMatch.noPackage();
        stubAdoptionMatcher();
        when(wingetMatcher.getFleetSource()).thenReturn(FleetSource.PROGRAMS);
        when(wingetMatcher.match(List.of(sevenZip))).thenReturn(List.of(match));

        // execution
        Map<InstalledProgram, PackageMatch> matches = matcher(wingetMatcher, chocoMatcher).match(List.of(sevenZip));

        // verifications
        assertThat(matches).containsEntry(sevenZip, match);
        verify(chocoMatcher, never()).match(anyList());
    }

    @Test
    void matchForAdoption_macApp_inTheAdoptionResultAndNotInTheManagingOne() {
        // setup
        PackageCatalogEntry slackCask = PackageCatalogEntry.builder().manager(PackageManagerType.BREW)
                .brewType(BrewPackageType.CASK).packageId("slack").name("Slack").aliases(List.of())
                .appNames(List.of("slack")).weakAppNames(List.of()).bundleIds(List.of("com.tinyspeck.slackmacgap"))
                .bundleIdPrefixes(List.of()).build();
        BrewCaskIndex brewCaskIndex = new BrewCaskIndex(List.of(slackCask));
        when(brewCaskIndexCache.getBrewCaskIndex()).thenReturn(brewCaskIndex);
        BrewAppMatcher brewAppMatcher = new BrewAppMatcher(brewCaskIndexCache);
        SoftwarePackageMatcher softwarePackageMatcher = matcher(brewAppMatcher);
        InstalledProgram slack = InstalledProgram.builder().fleetSource(FleetSource.APPS).name("Slack")
                .bundleIdentifier("com.tinyspeck.slackmacgap").build();

        // execution
        Map<InstalledProgram, PackageMatch> adoptionMatches = softwarePackageMatcher.matchForAdoption(List.of(slack));
        Map<InstalledProgram, PackageMatch> matches = softwarePackageMatcher.match(List.of(slack));

        // verifications
        assertThat(adoptionMatches).extractingByKey(slack).extracting(PackageMatch::getEntry).isSameAs(slackCask);
        assertThat(matches).isEmpty();
    }

    @Test
    void matchForAdoption_noAdoptionMatcherForTheTable_programLeftOut() {
        // setup
        InstalledProgram chrome = program("Google Chrome", FleetSource.PROGRAMS);
        when(wingetMatcher.getFleetSource()).thenReturn(FleetSource.PROGRAMS);

        // execution
        Map<InstalledProgram, PackageMatch> matches = matcher(wingetMatcher).matchForAdoption(List.of(chrome));

        // verifications
        assertThat(matches).isEmpty();
    }

    @Test
    void matchForAdoption_storedPackage_resolvedFromTheStoredAdoptionMatch() {
        // setup
        PackageCatalogEntry choco7zip = chocoPackage("7zip");
        SoftwarePackageMatch winget = new SoftwarePackageMatch(PackageMatchState.NO_PACKAGE, null, null, null);
        SoftwarePackageMatch choco = new SoftwarePackageMatch(PackageMatchState.MATCHED, PackageManagerType.CHOCO, "7zip", null);
        InstalledProgram sevenZip = InstalledProgram.builder().name("7-Zip").fleetSource(FleetSource.PROGRAMS)
                .storedMatch(winget).storedAdoptionMatch(choco).build();
        when(catalogRepository.findByManagerAndPackageIdIn(eq(PackageManagerType.CHOCO), eq(Set.of("7zip"))))
                .thenReturn(List.of(choco7zip));

        // execution
        PackageMatch match = matcher().matchForAdoption(List.of(sevenZip)).get(sevenZip);

        // verifications
        assertThat(match.getEntry()).isSameAs(choco7zip);
    }

    @Test
    void match_storedPackage_resolvedFromTheCatalogWithoutMatching() {
        // setup
        PackageCatalogEntry chromeEntry = wingetPackage("Google.Chrome");
        InstalledProgram chrome = stored("Google Chrome", PackageMatchState.MATCHED, "Google.Chrome");
        when(catalogRepository.findByManagerAndPackageIdIn(eq(PackageManagerType.WINGET), eq(Set.of("Google.Chrome"))))
                .thenReturn(List.of(chromeEntry));

        // execution
        PackageMatch match = matcher().match(List.of(chrome)).get(chrome);

        // verifications
        assertThat(match.getEntry()).isSameAs(chromeEntry);
    }

    @Test
    void match_storedNoPackageAndAmbiguous_answeredWithoutTheCatalog() {
        // setup
        InstalledProgram none = stored("Mesh Agent", PackageMatchState.NO_PACKAGE, null);
        InstalledProgram several = stored("WindowsAppRuntime.1.8", PackageMatchState.AMBIGUOUS, null);

        // execution
        Map<InstalledProgram, PackageMatch> matches = matcher().match(List.of(none, several));

        // verifications
        assertThat(matches.get(none).hasNoPackage()).isTrue();
        assertThat(matches.get(several).isMatched()).isFalse();
        assertThat(matches.get(several).hasNoPackage()).isFalse();
        verifyNoInteractions(catalogRepository);
    }

    @Test
    void match_storedPackageGoneFromTheCatalog_matchedAfresh() {
        // setup
        InstalledProgram chrome = stored("Google Chrome", PackageMatchState.MATCHED, "Google.Chrome.Old");
        PackageMatch fresh = PackageMatch.of(wingetPackage("Google.Chrome"));
        when(catalogRepository.findByManagerAndPackageIdIn(eq(PackageManagerType.WINGET), eq(Set.of("Google.Chrome.Old"))))
                .thenReturn(List.of());
        when(wingetMatcher.getFleetSource()).thenReturn(FleetSource.PROGRAMS);
        when(wingetMatcher.match(List.of(chrome))).thenReturn(List.of(fresh));

        // execution
        PackageMatch match = matcher(wingetMatcher).match(List.of(chrome)).get(chrome);

        // verifications
        assertThat(match).isSameAs(fresh);
    }

    @Test
    void toStored_everyOutcome() {
        Instant now = Instant.now();
        assertThat(PackageMatch.of(wingetPackage("Google.Chrome")).toStored(now))
                .isEqualTo(new SoftwarePackageMatch(PackageMatchState.MATCHED, PackageManagerType.WINGET, "Google.Chrome", now));
        assertThat(PackageMatch.noPackage().toStored(now).getState()).isEqualTo(PackageMatchState.NO_PACKAGE);
        assertThat(PackageMatch.ambiguous().toStored(now).getState()).isEqualTo(PackageMatchState.AMBIGUOUS);
    }

    private SoftwarePackageMatcher matcher(PackageMatcher... beans) {
        return new SoftwarePackageMatcher(provider(beans), catalogRepository);
    }

    private static InstalledProgram program(String name, FleetSource fleetSource) {
        return InstalledProgram.builder().name(name).fleetSource(fleetSource).build();
    }

    private static InstalledProgram stored(String name, PackageMatchState state, String packageId) {
        PackageManagerType manager = packageId == null ? null : PackageManagerType.WINGET;
        return InstalledProgram.builder().name(name).fleetSource(FleetSource.PROGRAMS)
                .storedMatch(new SoftwarePackageMatch(state, manager, packageId, null))
                .build();
    }

    private void stubAdoptionMatcher() {
        when(chocoMatcher.getFleetSource()).thenReturn(FleetSource.PROGRAMS);
        when(chocoMatcher.isForAdoption()).thenReturn(true);
    }

    private static PackageCatalogEntry chocoPackage(String id) {
        return PackageCatalogEntry.builder().manager(PackageManagerType.CHOCO).packageId(id).version("1.0").build();
    }

    private static PackageCatalogEntry wingetPackage(String id) {
        return PackageCatalogEntry.builder().manager(PackageManagerType.WINGET).packageId(id).version("1.0").build();
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<PackageMatcher> provider(PackageMatcher... beans) {
        ObjectProvider<PackageMatcher> provider = mock(ObjectProvider.class);
        when(provider.orderedStream()).thenAnswer(invocation -> Stream.of(beans));
        return provider;
    }
}
