package com.openframe.api.service.rmm.software.matching;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwarePackageMatcherTest {

    @Mock private PackageMatcher wingetMatcher;

    @Test
    void match_windowsPrograms_matchedByTheWingetMatcher() {
        // setup
        SoftwareResponse chrome = row("Google Chrome", "programs");
        PackageMatch match = PackageMatch.noPackage();
        when(wingetMatcher.getManager()).thenReturn(PackageManagerType.WINGET);
        when(wingetMatcher.match(List.of(chrome))).thenReturn(List.of(match));

        // execution
        Map<SoftwareResponse, PackageMatch> matches = new SoftwarePackageMatcher(matchers(wingetMatcher))
                .match(List.of(chrome));

        // verifications
        assertThat(matches).containsEntry(chrome, match);
    }

    @Test
    void match_rowsNoMatcherTakes_leftOut() {
        // setup
        when(wingetMatcher.getManager()).thenReturn(PackageManagerType.WINGET);
        SoftwarePackageMatcher packageMatcher = new SoftwarePackageMatcher(matchers(wingetMatcher));
        List<SoftwareResponse> rows = List.of(row("Google Chrome", "apps"), row("googlechrome", "chocolatey_packages"),
                row("xz", null));

        // execution
        Map<SoftwareResponse, PackageMatch> matches = packageMatcher.match(rows);

        // verifications
        assertThat(matches).isEmpty();
    }

    @Test
    void match_noMatcherForTheManager_rowLeftOut() {
        // setup
        SoftwarePackageMatcher packageMatcher = new SoftwarePackageMatcher(matchers());
        List<SoftwareResponse> rows = List.of(row("Google Chrome", "programs"));

        // execution
        Map<SoftwareResponse, PackageMatch> matches = packageMatcher.match(rows);

        // verifications
        assertThat(matches).isEmpty();
        verifyNoInteractions(wingetMatcher);
    }

    private static SoftwareResponse row(String name, String fleetSource) {
        return SoftwareResponse.builder().name(name).fleetSource(fleetSource).build();
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<PackageMatcher> matchers(PackageMatcher... beans) {
        ObjectProvider<PackageMatcher> provider = mock(ObjectProvider.class);
        when(provider.orderedStream()).thenAnswer(invocation -> Stream.of(beans));
        return provider;
    }
}
