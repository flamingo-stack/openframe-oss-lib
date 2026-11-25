package com.openframe.management.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class ChocoCatalogFetcherTest {

    private static final JsonMapper STRICT_JSON = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();
    private static final String CURATED = "curated";
    private static final String WINGET_ID = "7zip.7zip";
    private static final String CATALOG_JSON = """
            {"source":"x","generated":"2026-11-20T05:32:07Z","packages":[
              {"id":"7zip","version":"26.6.0","reason":"curated","file":"7zip.26.6.0.nupkg","sha256":"320c",
               "winget_id":"7zip.7zip","dependencies":[{"id":"7zip.install","range":"[26.6.0]"}]},
              {"id":"7zip.install","version":"26.6.0","reason":"dependency of 7zip"},
              {"id":"chocolatey","version":"2.7.5","reason":"curated"},
              {"id":"openframe-client","version":"1.7.34","reason":"own"}]}
            """;
    private static final String SEARCH_JSON = """
            {"totalHits":18,"data":[
              {"id":"GoogleChrome","title":"Google Chrome","description":"Chrome is a fast browser",
               "projectUrl":"https://www.google.com/chrome/browser/","iconUrl":"","version":"159.0.8154.13"}]}
            """;

    @Test
    void toEntries_mixedReasons_onlyCuratedPackagesKept() {
        // setup
        ChocoFeedCatalog catalog = catalog(
                pkg("7zip", "26.6.0", CURATED, null),
                pkg("7zip.install", "26.6.0", "dependency of 7zip", null),
                pkg("chocolatey", "2.7.5", CURATED, null),
                pkg("openframe-client", "1.7.34", "own", null),
                pkg("GoogleChrome", "159.0.8154.13", CURATED, null));

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search(), Map.of());

        // verifications
        assertThat(entries).extracting(PackageCatalogEntry::getPackageId).containsExactly("7zip", "GoogleChrome");
    }

    @ParameterizedTest
    @ValueSource(strings = {"chocolatey", "Chocolatey", "CHOCOLATEY"})
    void toEntries_chocolateyItselfInAnyLetterCase_leftOut(String id) {
        // setup
        ChocoFeedCatalog catalog = catalog(
                pkg(id, "2.7.5", CURATED, null),
                pkg("7zip", "26.6.0", CURATED, null));

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search(), Map.of());

        // verifications
        assertThat(entries).extracting(PackageCatalogEntry::getPackageId).containsExactly("7zip");
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "own", "dependency of 7zip"})
    void toEntries_reasonNotCurated_leftOut(String reason) {
        // setup
        ChocoFeedCatalog catalog = catalog(
                pkg("7zip.install", "26.6.0", reason, null),
                pkg("7zip", "26.6.0", CURATED, null));

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search(), Map.of());

        // verifications
        assertThat(entries).extracting(PackageCatalogEntry::getPackageId).containsExactly("7zip");
    }

    @Test
    void toEntries_noPackages_empty() {
        // setup
        ChocoFeedCatalog catalog = catalog();

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search(), Map.of());

        // verifications
        assertThat(entries).isEmpty();
    }

    @Test
    void toEntries_searchHitWithIdInOtherLetterCase_entryFromCatalogAndSearch() {
        // setup
        ChocoFeedCatalog catalog = catalog(pkg("googlechrome", "159.0.8154.13", CURATED, null));
        ChocoFeedSearch search = search(hit("GoogleChrome", "Google Chrome", "Chrome is a fast browser",
                "https://www.google.com/chrome/browser/"));

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search, Map.of());

        // verifications
        assertThat(entries)
                .extracting(PackageCatalogEntry::getManager, PackageCatalogEntry::getPackageId,
                        PackageCatalogEntry::getVersion, PackageCatalogEntry::getName,
                        PackageCatalogEntry::getDescription, PackageCatalogEntry::getHomepage)
                .containsExactly(tuple(PackageManagerType.CHOCO, "googlechrome", "159.0.8154.13", "Google Chrome",
                        "Chrome is a fast browser", "https://www.google.com/chrome/browser/"));
    }

    @Test
    void toEntries_severalPackages_eachTakesItsOwnSearchHit() {
        // setup
        ChocoFeedCatalog catalog = catalog(
                pkg("7zip", "26.6.0", CURATED, null),
                pkg("GoogleChrome", "159.0.8154.13", CURATED, null));
        ChocoFeedSearch search = search(
                hit("GoogleChrome", "Google Chrome", "Chrome is a fast browser", "https://www.google.com/chrome/browser/"),
                hit("7zip", "7-Zip", "7-Zip is a file archiver", "https://www.7-zip.org/"));

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search, Map.of());

        // verifications
        assertThat(entries)
                .extracting(PackageCatalogEntry::getPackageId, PackageCatalogEntry::getName,
                        PackageCatalogEntry::getHomepage)
                .containsExactly(
                        tuple("7zip", "7-Zip", "https://www.7-zip.org/"),
                        tuple("GoogleChrome", "Google Chrome", "https://www.google.com/chrome/browser/"));
    }

    @Test
    void toEntries_twoSearchHitsForTheSameIdInDifferentLetterCase_firstHitSuppliesTheTitle() {
        // setup
        ChocoFeedCatalog catalog = catalog(pkg("GoogleChrome", "159.0.8154.13", CURATED, null));
        ChocoFeedSearch search = search(
                hit("GoogleChrome", "Google Chrome", "Chrome is a fast browser", "https://www.google.com/chrome/browser/"),
                hit("googlechrome", "Chrome (duplicate)", "A second hit", "https://example.test/second"));

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search, Map.of());

        // verifications
        assertThat(entries)
                .extracting(PackageCatalogEntry::getPackageId, PackageCatalogEntry::getName,
                        PackageCatalogEntry::getDescription, PackageCatalogEntry::getHomepage)
                .containsExactly(tuple("GoogleChrome", "Google Chrome", "Chrome is a fast browser",
                        "https://www.google.com/chrome/browser/"));
    }

    @Test
    void toEntries_noSearchHit_idAsNameWithoutDescriptionAndHomepage() {
        // setup
        ChocoFeedCatalog catalog = catalog(pkg("7zip", "26.6.0", CURATED, null));
        ChocoFeedSearch search = search(hit("GoogleChrome", "Google Chrome", "Chrome is a fast browser",
                "https://www.google.com/chrome/browser/"));

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search, Map.of());

        // verifications
        assertThat(entries)
                .extracting(PackageCatalogEntry::getPackageId, PackageCatalogEntry::getName,
                        PackageCatalogEntry::getDescription, PackageCatalogEntry::getHomepage)
                .containsExactly(tuple("7zip", "7zip", null, null));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void toEntries_searchHitWithBlankTitle_idAsName(String title) {
        // setup
        ChocoFeedCatalog catalog = catalog(pkg("7zip", "26.6.0", CURATED, null));
        ChocoFeedSearch search = search(hit("7zip", title, "7-Zip is a file archiver", "https://www.7-zip.org/"));

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search, Map.of());

        // verifications
        assertThat(entries)
                .extracting(PackageCatalogEntry::getName, PackageCatalogEntry::getDescription,
                        PackageCatalogEntry::getHomepage)
                .containsExactly(tuple("7zip", "7-Zip is a file archiver", "https://www.7-zip.org/"));
    }

    @Test
    void toEntries_wingetIdFoundAmongWingetEntries_matchingKeysCopied() {
        // setup
        ChocoFeedCatalog catalog = catalog(pkg("7zip", "26.6.0", CURATED, WINGET_ID));
        Map<String, PackageCatalogEntry> wingetEntriesById = Map.of(WINGET_ID, wingetEntry());

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search(), wingetEntriesById);

        // verifications
        assertThat(entries)
                .extracting(PackageCatalogEntry::getProductCodes, PackageCatalogEntry::getUpgradeCodes,
                        PackageCatalogEntry::getPackageFamilyNames, PackageCatalogEntry::getNormalizedNames,
                        PackageCatalogEntry::getNormalizedPublishers)
                .containsExactly(tuple(
                        List.of("{23170f69-40c1-2702-2600-000001000000}"),
                        List.of("{23170f69-40c1-2702-0000-000004000000}"),
                        List.of("7zip.7zip_8wekyb3d8bbwe"),
                        List.of("7-zip", "7-zip(x64)"),
                        List.of("igorpavlov")));
    }

    @ParameterizedTest
    @ValueSource(strings = {"7Zip.7Zip", "7ZIP.7ZIP"})
    void toEntries_wingetIdInAnotherLetterCaseThanTheWingetEntry_matchingKeysCopied(String wingetId) {
        // setup
        ChocoFeedCatalog catalog = catalog(pkg("7zip", "26.6.0", CURATED, wingetId));
        Map<String, PackageCatalogEntry> wingetEntriesById = Map.of(WINGET_ID, wingetEntry());

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search(), wingetEntriesById);

        // verifications
        assertThat(entries)
                .extracting(PackageCatalogEntry::getPackageId, PackageCatalogEntry::getProductCodes,
                        PackageCatalogEntry::getNormalizedNames)
                .containsExactly(tuple("7zip", List.of("{23170f69-40c1-2702-2600-000001000000}"),
                        List.of("7-zip", "7-zip(x64)")));
    }

    @Test
    void toEntries_wingetEntriesKeyedInAnotherLetterCaseThanTheCatalog_matchingKeysCopied() {
        // setup
        ChocoFeedCatalog catalog = catalog(pkg("7zip", "26.6.0", CURATED, WINGET_ID));
        Map<String, PackageCatalogEntry> wingetEntriesById = Map.of("7Zip.7Zip", wingetEntry());

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search(), wingetEntriesById);

        // verifications
        assertThat(entries)
                .extracting(PackageCatalogEntry::getUpgradeCodes)
                .containsExactly(List.of("{23170f69-40c1-2702-0000-000004000000}"));
    }

    @Test
    void toEntries_wingetIdFoundAmongWingetEntries_entryStaysTheChocoPackage() {
        // setup
        ChocoFeedCatalog catalog = catalog(pkg("7zip", "26.6.0", CURATED, WINGET_ID));
        ChocoFeedSearch search = search(hit("7zip", "7-Zip", "7-Zip is a file archiver", "https://www.7-zip.org/"));
        Map<String, PackageCatalogEntry> wingetEntriesById = Map.of(WINGET_ID, wingetEntry());

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search, wingetEntriesById);

        // verifications
        assertThat(entries)
                .extracting(PackageCatalogEntry::getManager, PackageCatalogEntry::getPackageId,
                        PackageCatalogEntry::getVersion, PackageCatalogEntry::getName)
                .containsExactly(tuple(PackageManagerType.CHOCO, "7zip", "26.6.0", "7-Zip"));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "Mozilla.Firefox"})
    void toEntries_wingetIdAbsentOrNotAmongWingetEntries_noMatchingKeys(String wingetId) {
        // setup
        ChocoFeedCatalog catalog = catalog(pkg("7zip", "26.6.0", CURATED, wingetId));
        Map<String, PackageCatalogEntry> wingetEntriesById = Map.of(WINGET_ID, wingetEntry());

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search(), wingetEntriesById);

        // verifications
        assertThat(entries)
                .extracting(PackageCatalogEntry::getPackageId, PackageCatalogEntry::getProductCodes,
                        PackageCatalogEntry::getUpgradeCodes, PackageCatalogEntry::getPackageFamilyNames,
                        PackageCatalogEntry::getNormalizedNames, PackageCatalogEntry::getNormalizedPublishers)
                .containsExactly(tuple("7zip", null, null, null, null, null));
    }

    @ParameterizedTest
    @MethodSource("packagesWithoutIdOrVersion")
    void toEntries_packageWithoutIdOrVersion_skipped(String id, String version) {
        // setup
        ChocoFeedCatalog catalog = catalog(
                pkg(id, version, CURATED, null),
                pkg("GoogleChrome", "159.0.8154.13", CURATED, null));

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search(), Map.of());

        // verifications
        assertThat(entries).extracting(PackageCatalogEntry::getPackageId).containsExactly("GoogleChrome");
    }

    @Test
    void chocoFeedCatalog_realCatalogSample_readsWingetIdIgnoringUnknownFields() {
        // execution
        ChocoFeedCatalog catalog = STRICT_JSON.readValue(CATALOG_JSON, ChocoFeedCatalog.class);

        // verifications
        assertThat(catalog.getPackages())
                .extracting(ChocoFeedCatalog.Package::getId, ChocoFeedCatalog.Package::getVersion,
                        ChocoFeedCatalog.Package::getReason, ChocoFeedCatalog.Package::getWingetId)
                .containsExactly(
                        tuple("7zip", "26.6.0", "curated", "7zip.7zip"),
                        tuple("7zip.install", "26.6.0", "dependency of 7zip", null),
                        tuple("chocolatey", "2.7.5", "curated", null),
                        tuple("openframe-client", "1.7.34", "own", null));
    }

    @Test
    void chocoFeedSearch_realSearchSample_readsHitsIgnoringUnknownFields() {
        // execution
        ChocoFeedSearch search = STRICT_JSON.readValue(SEARCH_JSON, ChocoFeedSearch.class);

        // verifications
        assertThat(search.getData())
                .extracting(ChocoFeedSearch.Hit::getId, ChocoFeedSearch.Hit::getTitle,
                        ChocoFeedSearch.Hit::getDescription, ChocoFeedSearch.Hit::getProjectUrl)
                .containsExactly(tuple("GoogleChrome", "Google Chrome", "Chrome is a fast browser",
                        "https://www.google.com/chrome/browser/"));
    }

    @Test
    void toEntries_realCatalogAndSearchSamples_onlyTheCuratedAppWithItsIdAsName() {
        // setup
        ChocoFeedCatalog catalog = STRICT_JSON.readValue(CATALOG_JSON, ChocoFeedCatalog.class);
        ChocoFeedSearch search = STRICT_JSON.readValue(SEARCH_JSON, ChocoFeedSearch.class);

        // execution
        List<PackageCatalogEntry> entries = ChocoCatalogFetcher.toEntries(catalog, search, Map.of());

        // verifications
        assertThat(entries)
                .extracting(PackageCatalogEntry::getManager, PackageCatalogEntry::getPackageId,
                        PackageCatalogEntry::getVersion, PackageCatalogEntry::getName)
                .containsExactly(tuple(PackageManagerType.CHOCO, "7zip", "26.6.0", "7zip"));
    }

    private static ChocoFeedCatalog catalog(ChocoFeedCatalog.Package... packages) {
        ChocoFeedCatalog catalog = new ChocoFeedCatalog();
        catalog.setPackages(List.of(packages));
        return catalog;
    }

    private static ChocoFeedCatalog.Package pkg(String id, String version, String reason, String wingetId) {
        ChocoFeedCatalog.Package pkg = new ChocoFeedCatalog.Package();
        pkg.setId(id);
        pkg.setVersion(version);
        pkg.setReason(reason);
        pkg.setWingetId(wingetId);
        return pkg;
    }

    private static ChocoFeedSearch search(ChocoFeedSearch.Hit... hits) {
        ChocoFeedSearch search = new ChocoFeedSearch();
        search.setData(List.of(hits));
        return search;
    }

    private static ChocoFeedSearch.Hit hit(String id, String title, String description, String projectUrl) {
        ChocoFeedSearch.Hit hit = new ChocoFeedSearch.Hit();
        hit.setId(id);
        hit.setTitle(title);
        hit.setDescription(description);
        hit.setProjectUrl(projectUrl);
        return hit;
    }

    private static PackageCatalogEntry wingetEntry() {
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.WINGET)
                .packageId(WINGET_ID)
                .name("7-Zip (winget)")
                .version("26.06")
                .productCodes(List.of("{23170f69-40c1-2702-2600-000001000000}"))
                .upgradeCodes(List.of("{23170f69-40c1-2702-0000-000004000000}"))
                .packageFamilyNames(List.of("7zip.7zip_8wekyb3d8bbwe"))
                .normalizedNames(List.of("7-zip", "7-zip(x64)"))
                .normalizedPublishers(List.of("igorpavlov"))
                .build();
    }

    private static Stream<Arguments> packagesWithoutIdOrVersion() {
        return Stream.of(
                Arguments.of(null, "26.6.0"),
                Arguments.of("7zip", null)
        );
    }
}
