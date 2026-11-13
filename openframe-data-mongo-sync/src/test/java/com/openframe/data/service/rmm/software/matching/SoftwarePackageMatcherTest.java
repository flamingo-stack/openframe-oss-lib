package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.rmm.software.FleetSource;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwarePackageMatcherTest {

    @Mock private PackageMatcher wingetMatcher;
    @Mock private PackageCatalogRepository catalogRepository;

    @Test
    void match_windowsPrograms_matchedByTheWingetMatcher() {
        // setup
        InstalledProgram chrome = program("Google Chrome", FleetSource.PROGRAMS);
        PackageMatch match = PackageMatch.noPackage();
        when(wingetMatcher.getManager()).thenReturn(PackageManagerType.WINGET);
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
        when(wingetMatcher.getManager()).thenReturn(PackageManagerType.BREW);
        when(wingetMatcher.match(List.of(wget))).thenReturn(List.of(match));

        // execution
        Map<InstalledProgram, PackageMatch> matches = matcher(wingetMatcher).match(List.of(wget));

        // verifications
        assertThat(matches).containsEntry(wget, match);
    }

    @Test
    void match_programsNoMatcherTakes_leftOut() {
        // setup
        when(wingetMatcher.getManager()).thenReturn(PackageManagerType.WINGET);
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
        when(wingetMatcher.getManager()).thenReturn(PackageManagerType.WINGET);
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
