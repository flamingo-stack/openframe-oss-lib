package com.openframe.api.integration.repository;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogPage;
import com.openframe.data.repository.packagesearch.PackageCatalogRepositoryImpl;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class PackageCatalogRepositoryIT {

    private static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));
    private static final Sort MOST_POPULAR_FIRST = Sort.by(Sort.Order.desc("popularity"), Sort.Order.asc("packageId"));
    private static final Sort BY_NAME = Sort.by(Sort.Order.asc("name"), Sort.Order.asc("packageId"));
    private static final int FIRST_PAGE = 0;
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
                winget("SlackTechnologies.Slack", "Slack"),
                winget("Zoom.Zoom", "Zoom"),
                winget("Google.AndroidSDK.adb", "adb"),
                winget("7zip.7zip", "7-Zip"));
        repository.upsertAll(catalog);
    }

    @Test
    void searchByName_query_exactThenPrefixThenContainsThenMostPopular() {
        // execution
        PackageCatalogPage page = repository.searchByName(PackageManagerType.BREW, "slack", MOST_POPULAR_FIRST, FIRST_PAGE, PAGE_SIZE);

        // verifications
        assertThat(page.getEntries())
                .extracting(PackageCatalogEntry::getPackageId)
                .containsExactly("slack", "slack@beta", "slack-cli", "font-slackey");
        assertThat(page.getTotal()).isEqualTo(4);
    }

    @Test
    void searchByName_mixedCaseQuery_matchesCaseInsensitively() {
        // execution
        PackageCatalogPage page = repository.searchByName(PackageManagerType.BREW, "SLACK CLI", MOST_POPULAR_FIRST, FIRST_PAGE, PAGE_SIZE);

        // verifications
        assertThat(page.getEntries())
                .extracting(PackageCatalogEntry::getPackageId)
                .containsExactly("slack-cli");
        assertThat(page.getTotal()).isEqualTo(1);
    }

    @Test
    void searchByName_emptyQuery_wholeManagerCatalogPagedByTieBreak() {
        // execution
        PackageCatalogPage page = repository.searchByName(PackageManagerType.BREW, "", MOST_POPULAR_FIRST, 1, 2);

        // verifications
        assertThat(page.getEntries())
                .extracting(PackageCatalogEntry::getPackageId)
                .containsExactly("slack", "slack-cli");
        assertThat(page.getTotal()).isEqualTo(8);
    }

    @Test
    void searchByName_emptyQueryByName_orderIgnoresCase() {
        // execution
        PackageCatalogPage page = repository.searchByName(PackageManagerType.WINGET, "", BY_NAME, FIRST_PAGE, PAGE_SIZE);

        // verifications
        assertThat(page.getEntries())
                .extracting(PackageCatalogEntry::getName)
                .containsExactly("7-Zip", "adb", "Slack", "Zoom");
        assertThat(page.getTotal()).isEqualTo(4);
    }

    @Test
    void searchByName_offsetBeyondMatches_emptyPageKeepsTotal() {
        // execution
        PackageCatalogPage page = repository.searchByName(PackageManagerType.BREW, "slack", MOST_POPULAR_FIRST, 10, 5);

        // verifications
        assertThat(page.getEntries()).isEmpty();
        assertThat(page.getTotal()).isEqualTo(4);
    }

    @Test
    void searchByName_noMatches_emptyPageZeroTotal() {
        // execution
        PackageCatalogPage page = repository.searchByName(PackageManagerType.BREW, "nothing here", MOST_POPULAR_FIRST, FIRST_PAGE, PAGE_SIZE);

        // verifications
        assertThat(page.getEntries()).isEmpty();
        assertThat(page.getTotal()).isZero();
    }

    @Test
    void searchByName_specialCharacters_matchedLiterally() {
        // execution
        PackageCatalogPage page = repository.searchByName(PackageManagerType.BREW, "c++", MOST_POPULAR_FIRST, FIRST_PAGE, PAGE_SIZE);

        // verifications
        assertThat(page.getEntries())
                .extracting(PackageCatalogEntry::getPackageId)
                .containsExactly("cpp-tools");
    }

    @Test
    void searchByName_dollarPrefixedQuery_notAFieldReference() {
        // execution
        PackageCatalogPage page = repository.searchByName(PackageManagerType.BREW, "$name", MOST_POPULAR_FIRST, FIRST_PAGE, PAGE_SIZE);

        // verifications
        assertThat(page.getEntries()).isEmpty();
        assertThat(page.getTotal()).isZero();
    }

    private static PackageCatalogEntry brew(String packageId, String name, int popularity, String description) {
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
