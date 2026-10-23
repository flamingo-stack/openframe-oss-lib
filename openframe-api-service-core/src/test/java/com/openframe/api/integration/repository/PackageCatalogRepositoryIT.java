package com.openframe.api.integration.repository;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogHit;
import com.openframe.data.repository.packagesearch.PackageCatalogOrder;
import com.openframe.data.repository.packagesearch.PackageCatalogPage;
import com.openframe.data.repository.packagesearch.PackageCatalogRepositoryImpl;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.List;

import static com.openframe.data.document.packagesearch.PackageManagerType.BREW;
import static com.openframe.data.document.packagesearch.PackageManagerType.WINGET;
import static com.openframe.data.repository.packagesearch.PackageCatalogOrder.BY_NAME;
import static com.openframe.data.repository.packagesearch.PackageCatalogOrder.MOST_POPULAR_FIRST;
import static org.assertj.core.api.Assertions.assertThat;

@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class PackageCatalogRepositoryIT {

    private static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));
    private static final String FIRST_PAGE = null;
    private static final int PAGE_SIZE = 10;

    private static MongoTemplate mongoTemplate;
    private static PackageCatalogRepositoryImpl repository;

    @BeforeAll
    static void startMongo() {
        MONGO.start();
        String connectionString = MONGO.getConnectionString() + "/test?directConnection=true";
        MongoClient mongoClient = MongoClients.create(connectionString);
        mongoTemplate = new MongoTemplate(mongoClient, "test");
        repository = new PackageCatalogRepositoryImpl(mongoTemplate);
    }

    @AfterAll
    static void stopMongo() {
        MONGO.stop();
    }

    @BeforeEach
    void seedCatalog() {
        mongoTemplate.dropCollection(PackageCatalogEntry.class);
        List<PackageCatalogEntry> catalog = List.of(
                brew("slack", "Slack", 7594, null),
                brew("slack@beta", "Slack", 23, null),
                brew("slack-cli", "Slack CLI", 791, null),
                brew("font-slackey", "Font Slackey", 5, null),
                brew("gh", "gh", 90000, null),
                brew("jq", "jq", 400, "Slack-friendly JSON processor"),
                brew("slackish", "Totally Different", 1, null),
                brew("cpp-tools", "C++ Tools", 2, null),
                brew("unranked", "Unranked Tool", null, null),
                winget("SlackTechnologies.Slack", "Slack"),
                winget("Zoom.Zoom", "Zoom"),
                winget("Google.AndroidSDK.adb", "adb"),
                winget("7zip.7zip", "7-Zip"));
        repository.upsertAll(catalog);
    }

    @Test
    void searchByName_query_exactThenPrefixThenContainsThenMostPopular() {
        // execution
        PackageCatalogPage page = repository.searchByName(BREW, "slack", MOST_POPULAR_FIRST, FIRST_PAGE, PAGE_SIZE);

        // verifications
        assertThat(page.getHits())
                .extracting(PackageCatalogRepositoryIT::packageId)
                .containsExactly("slack", "slack@beta", "slack-cli", "font-slackey");
        assertThat(page.getTotal()).isEqualTo(4);
        assertThat(page.isHasMore()).isFalse();
    }

    @Test
    void searchByName_hitCursor_scorePackageIdSecondary() {
        // execution
        PackageCatalogPage brewPage = repository.searchByName(BREW, "slack", MOST_POPULAR_FIRST, FIRST_PAGE, 1);
        PackageCatalogPage wingetPage = repository.searchByName(WINGET, "", BY_NAME, FIRST_PAGE, 1);

        // verifications
        assertThat(brewPage.getHits())
                .extracting(PackageCatalogHit::getCursor)
                .containsExactly("3|slack|7594");
        assertThat(wingetPage.getHits())
                .extracting(PackageCatalogHit::getCursor)
                .containsExactly("2|7zip.7zip|7-Zip");
    }

    @Test
    void searchByName_pageThenCursor_continuesWithoutOverlapOrGaps() {
        // setup
        PackageCatalogPage firstPage = repository.searchByName(BREW, "slack", MOST_POPULAR_FIRST, FIRST_PAGE, 2);
        String afterSecondHit = lastCursor(firstPage);

        // execution
        PackageCatalogPage secondPage = repository.searchByName(BREW, "slack", MOST_POPULAR_FIRST, afterSecondHit, 2);

        // verifications
        assertThat(firstPage.getHits())
                .extracting(PackageCatalogRepositoryIT::packageId)
                .containsExactly("slack", "slack@beta");
        assertThat(firstPage.isHasMore()).isTrue();
        assertThat(secondPage.getHits())
                .extracting(PackageCatalogRepositoryIT::packageId)
                .containsExactly("slack-cli", "font-slackey");
        assertThat(secondPage.isHasMore()).isFalse();
        assertThat(secondPage.getTotal()).isEqualTo(4);
    }

    @Test
    void searchByName_emptyQueryCursor_walksPopularityTiersDownToUnranked() {
        // setup
        PackageCatalogPage firstPage = repository.searchByName(BREW, "", MOST_POPULAR_FIRST, FIRST_PAGE, 3);
        PackageCatalogPage secondPage = repository.searchByName(BREW, "", MOST_POPULAR_FIRST, lastCursor(firstPage), 3);

        // execution
        PackageCatalogPage thirdPage = repository.searchByName(BREW, "", MOST_POPULAR_FIRST, lastCursor(secondPage), 3);

        // verifications
        assertThat(firstPage.getHits())
                .extracting(PackageCatalogRepositoryIT::packageId)
                .containsExactly("gh", "slack", "slack-cli");
        assertThat(secondPage.getHits())
                .extracting(PackageCatalogRepositoryIT::packageId)
                .containsExactly("jq", "slack@beta", "font-slackey");
        assertThat(thirdPage.getHits())
                .extracting(PackageCatalogRepositoryIT::packageId)
                .containsExactly("cpp-tools", "slackish", "unranked");
        assertThat(thirdPage.isHasMore()).isFalse();
        assertThat(thirdPage.getTotal()).isEqualTo(9);
    }

    @Test
    void searchByName_byNameCursor_continuesCaseInsensitively() {
        // setup
        PackageCatalogPage firstPage = repository.searchByName(WINGET, "", BY_NAME, FIRST_PAGE, 2);

        // execution
        PackageCatalogPage secondPage = repository.searchByName(WINGET, "", BY_NAME, lastCursor(firstPage), 2);

        // verifications
        assertThat(firstPage.getHits())
                .extracting(PackageCatalogRepositoryIT::name)
                .containsExactly("7-Zip", "adb");
        assertThat(secondPage.getHits())
                .extracting(PackageCatalogRepositoryIT::name)
                .containsExactly("Slack", "Zoom");
        assertThat(secondPage.isHasMore()).isFalse();
    }

    @Test
    void searchByName_cursorOfLastHit_emptyPageKeepsTotal() {
        // setup
        PackageCatalogPage wholeResult = repository.searchByName(BREW, "slack", MOST_POPULAR_FIRST, FIRST_PAGE, PAGE_SIZE);

        // execution
        PackageCatalogPage pastTheEnd = repository.searchByName(BREW, "slack", MOST_POPULAR_FIRST, lastCursor(wholeResult), PAGE_SIZE);

        // verifications
        assertThat(pastTheEnd.getHits()).isEmpty();
        assertThat(pastTheEnd.isHasMore()).isFalse();
        assertThat(pastTheEnd.getTotal()).isEqualTo(4);
    }

    @Test
    void searchByName_invalidCursor_firstPageServed() {
        // execution
        PackageCatalogPage page = repository.searchByName(BREW, "slack", MOST_POPULAR_FIRST, "garbage", 2);

        // verifications
        assertThat(page.getHits())
                .extracting(PackageCatalogRepositoryIT::packageId)
                .containsExactly("slack", "slack@beta");
    }

    @Test
    void searchByName_mixedCaseQuery_matchesCaseInsensitively() {
        // execution
        PackageCatalogPage page = repository.searchByName(BREW, "SLACK CLI", MOST_POPULAR_FIRST, FIRST_PAGE, PAGE_SIZE);

        // verifications
        assertThat(page.getHits())
                .extracting(PackageCatalogRepositoryIT::packageId)
                .containsExactly("slack-cli");
        assertThat(page.getTotal()).isEqualTo(1);
    }

    @Test
    void searchByName_noMatches_emptyPageZeroTotal() {
        // execution
        PackageCatalogPage page = repository.searchByName(BREW, "nothing here", MOST_POPULAR_FIRST, FIRST_PAGE, PAGE_SIZE);

        // verifications
        assertThat(page.getHits()).isEmpty();
        assertThat(page.getTotal()).isZero();
        assertThat(page.isHasMore()).isFalse();
    }

    @Test
    void searchByName_specialCharacters_matchedLiterally() {
        // execution
        PackageCatalogPage page = repository.searchByName(BREW, "c++", MOST_POPULAR_FIRST, FIRST_PAGE, PAGE_SIZE);

        // verifications
        assertThat(page.getHits())
                .extracting(PackageCatalogRepositoryIT::packageId)
                .containsExactly("cpp-tools");
    }

    @Test
    void searchByName_dollarPrefixedQuery_notAFieldReference() {
        // execution
        PackageCatalogPage page = repository.searchByName(BREW, "$name", MOST_POPULAR_FIRST, FIRST_PAGE, PAGE_SIZE);

        // verifications
        assertThat(page.getHits()).isEmpty();
        assertThat(page.getTotal()).isZero();
    }

    private static String lastCursor(PackageCatalogPage page) {
        return page.getHits().getLast().getCursor();
    }

    private static String packageId(PackageCatalogHit hit) {
        return hit.getEntry().getPackageId();
    }

    private static String name(PackageCatalogHit hit) {
        return hit.getEntry().getName();
    }

    private static PackageCatalogEntry brew(String packageId, String name, Integer popularity, String description) {
        return PackageCatalogEntry.builder()
                .id("BREW:CASK:" + packageId)
                .manager(PackageManagerType.BREW)
                .packageId(packageId)
                .name(name)
                .description(description)
                .brewType(BrewPackageType.CASK)
                .popularity(popularity)
                .aliases(List.of())
                .build();
    }

    private static PackageCatalogEntry winget(String packageId, String name) {
        return PackageCatalogEntry.builder()
                .id("WINGET:" + packageId.toLowerCase())
                .manager(PackageManagerType.WINGET)
                .packageId(packageId)
                .name(name)
                .aliases(List.of())
                .build();
    }
}
