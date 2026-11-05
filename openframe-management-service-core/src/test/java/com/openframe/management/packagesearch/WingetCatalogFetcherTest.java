package com.openframe.management.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WingetCatalogFetcherTest {

    private static final String UPGRADE_CODE = "{0b36e3b7-0042-452d-b376-57e0c07addbb}";

    @Test
    void toEntry_displayVersionDiffersFromTheVersion_displayVersionKept() {
        // setup
        WingetEntry indexEntry = indexEntry("2026.44.1", "26.44.1");

        // execution
        PackageCatalogEntry entry = WingetCatalogFetcher.toEntry(indexEntry);

        // verifications
        assertThat(entry.getDisplayVersion()).isEqualTo("26.44.1");
    }

    @Test
    void toEntry_displayVersionSameAsTheVersion_noDisplayVersion() {
        // setup
        WingetEntry indexEntry = indexEntry("26.44.1", "26.44.1");

        // execution
        PackageCatalogEntry entry = WingetCatalogFetcher.toEntry(indexEntry);

        // verifications
        assertThat(entry.getDisplayVersion()).isNull();
    }

    @Test
    void toEntry_noDisplayVersion_noDisplayVersion() {
        // setup
        WingetEntry indexEntry = indexEntry("26.44.1", "");

        // execution
        PackageCatalogEntry entry = WingetCatalogFetcher.toEntry(indexEntry);

        // verifications
        assertThat(entry.getDisplayVersion()).isNull();
    }

    @Test
    void toEntry_matchingKeys_keptAsTheIndexHasThem() {
        // setup
        WingetEntry indexEntry = indexEntry("26.44.1", null);

        // execution
        PackageCatalogEntry entry = WingetCatalogFetcher.toEntry(indexEntry);

        // verifications
        assertThat(entry.getUpgradeCodes()).containsExactly(UPGRADE_CODE);
        assertThat(entry.getNormalizedNames()).containsExactly("lemonadeserver(X64)", "lemonadeserver");
    }

    private static WingetEntry indexEntry(String latestVersion, String latestDisplayVersion) {
        return WingetEntry.builder()
                .id("AMD.LemonadeServer")
                .name("Lemonade Server")
                .latestVersion(latestVersion)
                .latestDisplayVersion(latestDisplayVersion)
                .upgradeCodes(List.of(UPGRADE_CODE))
                .normalizedNames(List.of("lemonadeserver(X64)", "lemonadeserver"))
                .build();
    }
}
