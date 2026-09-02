package com.openframe.packagesearch.api;

import com.openframe.packagesearch.PackageCatalogEntry;
import com.openframe.packagesearch.BrewPackageType;
import com.openframe.packagesearch.api.dto.PackageDetails;
import com.openframe.packagesearch.PackageManagerType;
import com.openframe.packagesearch.api.dto.PackageSearchResult;
import com.openframe.packagesearch.api.PackageNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BrewPackageServiceTest {

    private PackageCatalogReader catalogReader;
    private BrewPackageService service;

    @BeforeEach
    void setUp() {
        catalogReader = mock(PackageCatalogReader.class);
        service = new BrewPackageService(catalogReader);
    }

    @Test
    void ranksExactMatchAbovePrefixAndByPopularity() {
        PackageCatalogEntry slack = caskEntry("slack", "Slack", 7594);
        PackageCatalogEntry slackCli = caskEntry("slack-cli", "Slack CLI", 791);
        PackageCatalogEntry slackBeta = caskEntry("slack@beta", "Slack", 23);
        when(catalogReader.findCandidates(PackageManagerType.BREW, "slack")).thenReturn(List.of(slackCli, slackBeta, slack));

        PackageSearchResult result = service.search("slack", 3, 0);

        // slack@beta outranks slack-cli: its display name "Slack" is an exact name match
        List<String> ids = result.getItems().stream().map(item -> item.getId()).toList();
        assertEquals(List.of("slack", "slack@beta", "slack-cli"), ids);
        assertEquals(3, result.getTotal());
    }

    @Test
    void findPackagePrefersFormulaWhenTypeAbsent() {
        PackageCatalogEntry formula = formulaEntry("wireshark", "wireshark", 100);
        when(catalogReader.findByEntryIds(List.of("BREW:FORMULA:wireshark", "BREW:CASK:wireshark")))
                .thenReturn(List.of(formula));

        PackageDetails details = service.findPackage("wireshark", null);

        assertEquals(BrewPackageType.FORMULA, details.getPackageType());
        assertEquals("brew install wireshark", details.getInstallCommand());
    }

    @Test
    void findPackageHonorsRequestedCaskType() {
        PackageCatalogEntry cask = caskEntry("slack", "Slack", 7594);
        when(catalogReader.findByEntryIds(List.of("BREW:CASK:slack"))).thenReturn(List.of(cask));

        PackageDetails details = service.findPackage("slack", BrewPackageType.CASK);

        assertEquals(BrewPackageType.CASK, details.getPackageType());
        assertEquals("brew install --cask slack", details.getInstallCommand());
    }

    @Test
    void findPackageThrowsWhenUnknown() {
        when(catalogReader.findByEntryIds(List.of("BREW:FORMULA:nope", "BREW:CASK:nope"))).thenReturn(List.of());

        assertThrows(PackageNotFoundException.class, () -> service.findPackage("nope", null));
    }

    @Test
    void paginationReportsHasMore() {
        PackageCatalogEntry slack = caskEntry("slack", "Slack", 7594);
        PackageCatalogEntry slackCli = caskEntry("slack-cli", "Slack CLI", 791);
        when(catalogReader.findCandidates(PackageManagerType.BREW, "slack")).thenReturn(List.of(slack, slackCli));

        PackageSearchResult firstPage = service.search("slack", 1, 0);

        assertEquals(1, firstPage.getItems().size());
        assertTrue(firstPage.isHasMore());
    }

    private static PackageCatalogEntry caskEntry(String id, String name, int popularity) {
        return entry(id, name, "CASK", popularity);
    }

    private static PackageCatalogEntry formulaEntry(String id, String name, int popularity) {
        return entry(id, name, "FORMULA", popularity);
    }

    private static PackageCatalogEntry entry(String id, String name, String brewType, int popularity) {
        return PackageCatalogEntry.builder()
                .id("BREW:" + brewType + ":" + id)
                .manager("BREW")
                .packageId(id)
                .name(name)
                .brewType(brewType)
                .version("1.0.0")
                .popularity(popularity)
                .aliases(List.of())
                .build();
    }
}
