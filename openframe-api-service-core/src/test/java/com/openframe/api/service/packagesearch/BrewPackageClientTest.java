package com.openframe.api.service.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.exception.PackageNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BrewPackageClientTest {

    private PackageCatalogRepository packageCatalogRepository;
    private BrewPackageClient client;

    @BeforeEach
    void setUp() {
        packageCatalogRepository = mock(PackageCatalogRepository.class);
        client = new BrewPackageClient(packageCatalogRepository);
    }

    @Test
    void ranksExactMatchAbovePrefixAndByPopularity() {
        PackageCatalogEntry slack = caskEntry("slack", "Slack", 7594);
        PackageCatalogEntry slackCli = caskEntry("slack-cli", "Slack CLI", 791);
        PackageCatalogEntry slackBeta = caskEntry("slack@beta", "Slack", 23);
        when(packageCatalogRepository.findByManagerAndSearchBlobContaining(PackageManagerType.BREW, "slack")).thenReturn(List.of(slackCli, slackBeta, slack));

        PackageSearchResult result = client.search("slack", 3, 0);

        // slack@beta outranks slack-cli: its display name "Slack" is an exact name match
        List<String> ids = result.getItems().stream().map(item -> item.getId()).toList();
        assertEquals(List.of("slack", "slack@beta", "slack-cli"), ids);
        assertEquals(3, result.getTotal());
    }

    @Test
    void findPackagePrefersFormulaWhenTypeAbsent() {
        PackageCatalogEntry formula = formulaEntry("wireshark", "wireshark", 100);
        when(packageCatalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.BREW, "wireshark"))
                .thenReturn(List.of(formula));

        PackageDetails details = client.findPackage("wireshark", null);

        assertEquals(BrewPackageType.FORMULA, details.getPackageType());
        assertEquals("brew install wireshark", details.getInstallCommand());
    }

    @Test
    void findPackageHonorsRequestedCaskType() {
        PackageCatalogEntry cask = caskEntry("slack", "Slack", 7594);
        PackageCatalogEntry formulaTwin = formulaEntry("slack", "slack", 1);
        when(packageCatalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.BREW, "slack"))
                .thenReturn(List.of(formulaTwin, cask));

        PackageDetails details = client.findPackage("slack", BrewPackageType.CASK);

        assertEquals(BrewPackageType.CASK, details.getPackageType());
        assertEquals("brew install --cask slack", details.getInstallCommand());
    }

    @Test
    void findPackageThrowsWhenUnknown() {
        when(packageCatalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.BREW, "nope")).thenReturn(List.of());

        assertThrows(PackageNotFoundException.class, () -> client.findPackage("nope", null));
    }

    @Test
    void paginationReportsHasMore() {
        PackageCatalogEntry slack = caskEntry("slack", "Slack", 7594);
        PackageCatalogEntry slackCli = caskEntry("slack-cli", "Slack CLI", 791);
        when(packageCatalogRepository.findByManagerAndSearchBlobContaining(PackageManagerType.BREW, "slack")).thenReturn(List.of(slack, slackCli));

        PackageSearchResult firstPage = client.search("slack", 1, 0);

        assertEquals(1, firstPage.getItems().size());
        assertTrue(firstPage.isHasMore());
    }

    private static PackageCatalogEntry caskEntry(String id, String name, int popularity) {
        return entry(id, name, BrewPackageType.CASK, popularity);
    }

    private static PackageCatalogEntry formulaEntry(String id, String name, int popularity) {
        return entry(id, name, BrewPackageType.FORMULA, popularity);
    }

    private static PackageCatalogEntry entry(String id, String name, BrewPackageType brewType, int popularity) {
        return PackageCatalogEntry.builder()
                .id("BREW:" + brewType + ":" + id)
                .manager(PackageManagerType.BREW)
                .packageId(id)
                .name(name)
                .brewType(brewType)
                .version("1.0.0")
                .popularity(popularity)
                .aliases(List.of())
                .build();
    }
}
