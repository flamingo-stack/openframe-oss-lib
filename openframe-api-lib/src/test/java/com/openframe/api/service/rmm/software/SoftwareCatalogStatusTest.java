package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareVersionStatus;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collection;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareCatalogStatusTest {

    @Mock private PackageCatalogRepository catalogRepository;

    private SoftwareCatalogStatus status() {
        return new SoftwareCatalogStatus(catalogRepository);
    }

    @Test
    void brewFormulaBehindTheCatalog_isOutdatedWithTheCatalogAsLatest() {
        SoftwareResponse xz = row("xz", SoftwareSource.BREW, "5.8.3", 0);
        catalog(entry("xz", "5.8.4", BrewPackageType.FORMULA));

        status().apply(List.of(xz));

        assertThat(xz.getVersionStatus()).isEqualTo(SoftwareVersionStatus.OUTDATED);
        assertThat(xz.getLatestVersion()).isEqualTo("5.8.4");
        assertThat(xz.getAutoUpdate()).isEqualTo(SoftwareAutoUpdateStatus.OFF);
    }

    @Test
    void brewFormulaAtOrPastTheCatalog_isUpToDate() {
        SoftwareResponse same = row("jq", SoftwareSource.BREW, "1.7.1", 0);
        SoftwareResponse ahead = row("git", SoftwareSource.BREW, "2.51.1", 0);
        catalog(entry("jq", "1.7.1", BrewPackageType.FORMULA), entry("git", "2.51.0", BrewPackageType.FORMULA));

        status().apply(List.of(same, ahead));

        assertThat(same.getVersionStatus()).isEqualTo(SoftwareVersionStatus.UP_TO_DATE);
        assertThat(ahead.getVersionStatus()).isEqualTo(SoftwareVersionStatus.UP_TO_DATE);
    }

    @Test
    void formulaAndCaskSharingAToken_theFormulaWins() {
        SoftwareResponse docker = row("docker", SoftwareSource.BREW, "28.0.0", 0);
        catalog(entry("docker", "4.40.0", BrewPackageType.CASK), entry("docker", "28.1.0", BrewPackageType.FORMULA));

        status().apply(List.of(docker));

        assertThat(docker.getLatestVersion()).isEqualTo("28.1.0");
        assertThat(docker.getVersionStatus()).isEqualTo(SoftwareVersionStatus.OUTDATED);
    }

    @Test
    void brewTitleTheCatalogDoesNotCarry_hasNoPackageAndAnUnknownStatus() {
        SoftwareResponse tapped = row("some-tap-tool", SoftwareSource.BREW, "1.0.0", 0);
        catalog();

        status().apply(List.of(tapped));

        assertThat(tapped.getAutoUpdate()).isEqualTo(SoftwareAutoUpdateStatus.NO_PACKAGE);
        assertThat(tapped.getVersionStatus()).isEqualTo(SoftwareVersionStatus.UNKNOWN);
    }

    @Test
    void anAutoUpdatePolicy_staysAsItIs() {
        SoftwareResponse xz = row("xz", SoftwareSource.BREW, "5.8.3", 0);
        xz.setAutoUpdate(SoftwareAutoUpdateStatus.ON);
        catalog(entry("xz", "5.8.4", BrewPackageType.FORMULA));

        status().apply(List.of(xz));

        assertThat(xz.getAutoUpdate()).isEqualTo(SoftwareAutoUpdateStatus.ON);
    }

    @Test
    void devicesOnDifferentVersions_areOutdatedWithoutTheCatalog() {
        SoftwareResponse chrome = row("Google Chrome", SoftwareSource.UNMANAGED, "141.0", 2);

        status().apply(List.of(chrome));

        assertThat(chrome.getVersionStatus()).isEqualTo(SoftwareVersionStatus.OUTDATED);
        verifyNoInteractions(catalogRepository);
    }

    // with one version everywhere and no catalog entry nothing says whether a newer release is out
    @Test
    void notABrewTitle_keepsItsLatestAndAutoUpdate_statusUnknown() {
        SoftwareResponse acrobat = row("Adobe Acrobat", SoftwareSource.UNMANAGED, "25.1", 0);
        acrobat.setLatestVersion("25.1");

        status().apply(List.of(acrobat));

        assertThat(acrobat.getVersionStatus()).isEqualTo(SoftwareVersionStatus.UNKNOWN);
        assertThat(acrobat.getLatestVersion()).isEqualTo("25.1");
        assertThat(acrobat.getAutoUpdate()).isNull();
        verifyNoInteractions(catalogRepository);
    }

    @Test
    void oneCatalogQueryForAllBrewRows_byLowerCaseToken() {
        catalog(entry("xz", "5.8.4", BrewPackageType.FORMULA));

        status().apply(List.of(row("XZ", SoftwareSource.BREW, "5.8.4", 0), row("jq", SoftwareSource.BREW, "1.7", 0),
                row("Slack", SoftwareSource.UNMANAGED, "4.4", 0)));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<String>> tokens = ArgumentCaptor.forClass(Collection.class);
        verify(catalogRepository).findByManagerAndPackageIdIn(eq(PackageManagerType.BREW), tokens.capture());
        assertThat(tokens.getValue()).containsExactlyInAnyOrder("xz", "jq");
    }

    @Test
    void catalogEntryWithoutAVersionOrToken_isSkipped() {
        SoftwareResponse xz = row("xz", SoftwareSource.BREW, "5.8.3", 0);
        PackageCatalogEntry noToken = entry(null, "9.9.9", BrewPackageType.FORMULA);
        catalog(entry("xz", null, BrewPackageType.FORMULA), noToken, entry("xz", "5.8.4", BrewPackageType.CASK));

        status().apply(List.of(xz));

        assertThat(xz.getLatestVersion()).isEqualTo("5.8.4");
        assertThat(xz.getVersionStatus()).isEqualTo(SoftwareVersionStatus.OUTDATED);
    }

    private void catalog(PackageCatalogEntry... entries) {
        when(catalogRepository.findByManagerAndPackageIdIn(eq(PackageManagerType.BREW), any()))
                .thenReturn(List.of(entries));
    }

    private static PackageCatalogEntry entry(String token, String version, BrewPackageType type) {
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.BREW)
                .packageId(token)
                .version(version)
                .brewType(type)
                .build();
    }

    private static SoftwareResponse row(String name, SoftwareSource source, String currentVersion, int older) {
        return SoftwareResponse.builder()
                .name(name)
                .source(source)
                .currentVersion(currentVersion)
                .olderVersionsCount(older)
                .build();
    }
}
