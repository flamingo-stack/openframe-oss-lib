package com.openframe.test.tests;

import com.openframe.test.api.PackageSearchApi;
import com.openframe.test.data.dto.packagesearch.PackageDetails;
import com.openframe.test.data.dto.packagesearch.PackageSearchConnection;
import com.openframe.test.data.dto.packagesearch.PackageSearchItem;
import com.openframe.test.data.dto.packagesearch.PackageVersion;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;

// Public package catalog behind the Software install form (CP-34), read-only; winget details need Microsoft's CDN, and per-manager field gaps are pinned, not asserted away.
@Tag("saas")
@Tag("package-search")
@DisplayName("Package search")
public class PackageSearchTest extends BaseTest {

    private static final String BREW = "BREW";
    private static final String CHOCO = "CHOCO";
    private static final String WINGET = "WINGET";
    private static final String FORMULA = "FORMULA";
    private static final String CASK = "CASK";

    // A formula with no cask of the same name; the cask lookup of it is the strict-packageType negative case.
    private static final String BREW_FORMULA_ONLY = "wget";
    // A Homebrew term whose first hits include both a formula (wireshark) and a cask (wireshark-app).
    private static final String BREW_MIXED_SEARCH = "wireshark";
    // A long-lived winget package with many published versions and a slow release cadence.
    private static final String WINGET_PACKAGE = "7zip.7zip";
    // A broad Homebrew term with far more matches than the two pages the pagination case reads.
    private static final String BROAD_SEARCH = "python";
    private static final int PAGE = 5;
    // The server's page cap (PackageSearchService.MAX_LIMIT): Chocolatey's 40-row page less one look-ahead row.
    private static final int MAX_PAGE = 39;

    private static final String UNKNOWN_ID = "no-such-package-" + RunId.next();

    @Tag("feature")
    @Test
    @DisplayName("Search Homebrew and open a formula by the id and packageType the search returned")
    public void testBrewSearchAndDetails() {
        PackageSearchConnection found = PackageSearchApi.searchPackages(BREW, BREW_FORMULA_ONLY, 10, null);
        List<PackageSearchItem> items = found.nodes();
        assertThat(items).as("Homebrew search for '%s' finds it", BREW_FORMULA_ONLY).isNotEmpty();
        assertThat(found.getFilteredCount()).as("filteredCount counts at least the returned page").isGreaterThanOrEqualTo(items.size());
        for (PackageSearchItem item : items) {
            assertThat(item.getPackageManager()).as("Every hit of a BREW search is a BREW package: %s", item.getId()).isEqualTo(BREW);
            assertThat(item.getPackageType()).as("Every BREW hit says formula or cask: %s", item.getId()).isIn(FORMULA, CASK);
            assertThat(item.getInstallCommand()).as("Every hit carries an install command: %s", item.getId()).isNotBlank();
            assertThat(item.getPublisher()).as("publisher is WINGET-only in search results: %s", item.getId()).isNull();
            assertThat(item.getIconUrl()).as("iconUrl is CHOCO-only in search results: %s", item.getId()).isNull();
        }

        PackageSearchItem wget = items.stream()
                .filter(item -> BREW_FORMULA_ONLY.equals(item.getId()))
                .findFirst().orElse(null);
        assertThat(wget).as("The exact-name match '%s' is among the hits %s", BREW_FORMULA_ONLY, found.ids()).isNotNull();
        assertThat(wget.getName()).as("A hit is named").isNotBlank();
        assertThat(wget.getPackageType()).as("'%s' is a formula", BREW_FORMULA_ONLY).isEqualTo(FORMULA);
        assertThat(wget.getInstallCommand()).as("A formula installs without --cask").isEqualTo("brew install " + BREW_FORMULA_ONLY);
        assertThat(wget.getPopularity()).as("Homebrew publishes 30-day installs as popularity").isNotNull().isPositive();

        PackageDetails details = PackageSearchApi.packageDetails(BREW, wget.getId(), wget.getPackageType());
        assertThat(details.getId()).as("Details answer for the id the search returned").isEqualTo(wget.getId());
        assertThat(details.getPackageManager()).as("Details keep the package manager").isEqualTo(BREW);
        assertThat(details.getName()).as("Details and search agree on the name").isEqualTo(wget.getName());
        assertThat(details.getPackageType()).as("Details open the type that was passed back").isEqualTo(FORMULA);
        assertThat(details.getInstallCommand()).as("Details and search agree on the install command").isEqualTo(wget.getInstallCommand());
        assertThat(details.getPopularity()).as("popularity is published for BREW details").isNotNull();
        assertThat(details.getPublisher()).as("Homebrew publishes no publisher").isNull();
        assertThat(details.getTags()).as("tags is non-null (and empty for Homebrew)").isNotNull().isEmpty();
        assertThat(details.getVersions()).extracting(PackageVersion::getVersion)
                .as("Homebrew publishes only the current version, the one search reported as latest")
                .containsExactly(wget.getVersion());
        assertThat(details.getVersions()).extracting(PackageVersion::getReleasedAt)
                .as("releasedAt is Chocolatey-only").containsOnlyNulls();
    }

    // No name exists as both formula and cask any more (Homebrew renamed them), so each hit must open as exactly its own type, never the other.
    @Tag("feature")
    @Test
    @DisplayName("packageType opens exactly the Homebrew formula or cask the search returned")
    public void testBrewPackageTypeIsHonoured() {
        List<PackageSearchItem> items = PackageSearchApi.searchPackages(BREW, BREW_MIXED_SEARCH, 10, null).nodes();
        for (String type : List.of(FORMULA, CASK)) {
            PackageSearchItem item = items.stream()
                    .filter(node -> type.equals(node.getPackageType()))
                    .findFirst().orElse(null);
            assertThat(item).as("Homebrew search for '%s' returns a %s", BREW_MIXED_SEARCH, type).isNotNull();

            PackageDetails details = PackageSearchApi.packageDetails(BREW, item.getId(), item.getPackageType());
            assertThat(details.getId()).as("%s %s: details keep the id", type, item.getId()).isEqualTo(item.getId());
            assertThat(details.getPackageType()).as("%s %s: details open the requested type", type, item.getId()).isEqualTo(type);
            assertThat(details.getInstallCommand()).as("%s %s: details and search agree on the install command", type, item.getId())
                    .isEqualTo(item.getInstallCommand());
            String expectedCommand = CASK.equals(type) ? "brew install --cask " + item.getId() : "brew install " + item.getId();
            assertThat(item.getInstallCommand()).as("%s %s: only a cask installs with --cask", type, item.getId())
                    .isEqualTo(expectedCommand);

            String otherType = CASK.equals(type) ? FORMULA : CASK;
            assertThat(codes(PackageSearchApi.attemptPackageDetailsErrors(BREW, item.getId(), otherType)))
                    .as("%s %s asked for as a %s is NOT_FOUND; the %s is not opened in its place", type, item.getId(), otherType, type)
                    .containsExactly("NOT_FOUND");
        }
    }

    @Tag("feature")
    @Test
    @DisplayName("Search winget and open a package's versions, newest first (needs the public winget CDN)")
    public void testWingetSearchAndDetails() {
        PackageSearchConnection found = PackageSearchApi.searchPackages(WINGET, WINGET_PACKAGE, 10, null);
        PackageSearchItem item = found.nodes().stream()
                .filter(node -> WINGET_PACKAGE.equalsIgnoreCase(node.getId()))
                .findFirst().orElse(null);
        assertThat(item).as("winget search for '%s' finds it among %s", WINGET_PACKAGE, found.ids()).isNotNull();
        assertThat(item.getPackageManager()).as("A WINGET hit is a WINGET package").isEqualTo(WINGET);
        assertThat(item.getPublisher()).as("publisher is published in WINGET search results").isNotBlank();
        assertThat(item.getIconUrl()).as("iconUrl is CHOCO-only in search results").isNull();
        assertThat(item.getPopularity()).as("popularity is BREW/CHOCO-only").isNull();
        assertThat(item.getPackageType()).as("packageType is BREW-only").isNull();
        assertThat(item.getInstallCommand()).as("winget installs by exact id").isEqualTo("winget install -e --id " + item.getId());

        PackageDetails details = PackageSearchApi.packageDetails(WINGET, item.getId(), null);
        assertThat(details.getId()).as("Details answer for the id the search returned").isEqualTo(item.getId());
        assertThat(details.getPackageManager()).as("Details keep the package manager").isEqualTo(WINGET);
        assertThat(details.getPublisher()).as("winget details carry the publisher").isNotBlank();
        assertThat(details.getPopularity()).as("popularity is BREW/CHOCO-only").isNull();
        assertThat(details.getPackageType()).as("packageType is BREW-only").isNull();
        assertThat(details.getInstallCommand()).as("Details and search agree on the install command").isEqualTo(item.getInstallCommand());
        assertThat(details.getTags()).as("tags is non-null").isNotNull();

        List<String> versions = details.getVersions().stream().map(PackageVersion::getVersion).toList();
        assertThat(versions).as("winget details list the published versions").isNotEmpty().doesNotHaveDuplicates();
        assertThat(versions.getFirst()).as("Versions are newest first: the first is the latest the search reported (all: %s)", versions)
                .isEqualTo(item.getVersion());
        assertThat(details.getVersions()).extracting(PackageVersion::getReleasedAt)
                .as("releasedAt is Chocolatey-only").containsOnlyNulls();
    }

    @Tag("feature")
    @Test
    @DisplayName("Page forward through a search by passing pageInfo.endCursor back as after")
    public void testForwardPagination() {
        PackageSearchConnection first = PackageSearchApi.searchPackages(BREW, BROAD_SEARCH, PAGE, null);
        assertThat(first.getEdges()).as("The first page is full").hasSize(PAGE);
        assertThat(first.getFilteredCount()).as("'%s' matches more than two pages", BROAD_SEARCH).isGreaterThan(2 * PAGE);
        assertThat(first.getPageInfo().getHasNextPage()).as("The first page has a next page").isTrue();
        assertThat(first.getPageInfo().getHasPreviousPage()).as("The first page has no previous page").isFalse();
        assertThat(first.getPageInfo().getEndCursor()).as("endCursor is the last edge's cursor")
                .isEqualTo(first.getEdges().getLast().getCursor());

        PackageSearchConnection second = PackageSearchApi.searchPackages(BREW, BROAD_SEARCH, PAGE, first.getPageInfo().getEndCursor());
        assertThat(second.getEdges()).as("The second page is full").hasSize(PAGE);
        assertThat(second.getPageInfo().getHasPreviousPage()).as("The second page has a previous page").isTrue();
        assertThat(second.getFilteredCount()).as("filteredCount does not depend on the page").isEqualTo(first.getFilteredCount());

        // compared by (id, type): the schema allows one name to exist as both a formula and a cask
        PackageSearchConnection both = PackageSearchApi.searchPackages(BREW, BROAD_SEARCH, 2 * PAGE, null);
        List<String> paged = new ArrayList<>(keys(first));
        paged.addAll(keys(second));
        assertThat(paged).as("The two pages are the first %d results in order, with nothing skipped or repeated", 2 * PAGE)
                .containsExactlyElementsOf(keys(both));
    }

    @Tag("feature")
    @Test
    @DisplayName("A page larger than the server cap is clamped to it")
    public void testPageSizeIsCapped() {
        PackageSearchConnection page = PackageSearchApi.searchPackages(BREW, BROAD_SEARCH, 100, null);
        assertThat(page.getFilteredCount()).as("'%s' matches more than one capped page", BROAD_SEARCH).isGreaterThan(MAX_PAGE);
        assertThat(page.getEdges()).as("first: 100 answers at most the %d-row cap", MAX_PAGE).hasSize(MAX_PAGE);
        assertThat(page.getPageInfo().getHasNextPage()).as("A capped page still reports the rest").isTrue();
    }

    @Tag("feature")
    @Test
    @DisplayName("packageDetails errors NOT_FOUND on an unknown id and on the wrong Homebrew type")
    public void testPackageDetailsNotFound() {
        assertThat(codes(PackageSearchApi.attemptPackageDetailsErrors(BREW, UNKNOWN_ID, null)))
                .as("An unknown Homebrew id is NOT_FOUND").containsExactly("NOT_FOUND");
        assertThat(codes(PackageSearchApi.attemptPackageDetailsErrors(WINGET, UNKNOWN_ID, null)))
                .as("An unknown winget id is NOT_FOUND").containsExactly("NOT_FOUND");
        assertThat(codes(PackageSearchApi.attemptPackageDetailsErrors(BREW, BREW_FORMULA_ONLY, CASK)))
                .as("packageType is honoured strictly: the cask of a formula-only name is NOT_FOUND, not the formula")
                .containsExactly("NOT_FOUND");
        assertThat(codes(PackageSearchApi.attemptPackageDetailsErrors(BREW, "   ", null)))
                .as("A blank packageId is a VALIDATION_ERROR").containsExactly("VALIDATION_ERROR");
    }

    // Chocolatey is off (openframe.package-managers.choco-enabled defaults to false and nothing sets it); when this fails, add the Chocolatey assertions.
    @Tag("feature")
    @Test
    @DisplayName("Chocolatey is refused while the deployment keeps it disabled")
    public void testChocolateyDisabled() {
        List<GraphqlError> searchErrors = PackageSearchApi.attemptSearchPackagesErrors(CHOCO, "firefox", PAGE);
        assertThat(codes(searchErrors)).as("A CHOCO search is a VALIDATION_ERROR while Chocolatey is disabled")
                .containsExactly("VALIDATION_ERROR");
        assertThat(searchErrors).extracting(GraphqlError::getMessage).as("The refusal names the disabled manager")
                .contains("package manager CHOCO is currently disabled");

        List<GraphqlError> detailsErrors = PackageSearchApi.attemptPackageDetailsErrors(CHOCO, "firefox", null);
        assertThat(codes(detailsErrors)).as("CHOCO details are a VALIDATION_ERROR while Chocolatey is disabled")
                .containsExactly("VALIDATION_ERROR");
    }

    private static List<String> keys(PackageSearchConnection connection) {
        return connection.nodes().stream().map(item -> item.getId() + "/" + item.getPackageType()).toList();
    }

    // Codes of the errors that carry one; graphql-java's code-less NullValueInNonNullableField is dropped.
    private static List<Object> codes(List<GraphqlError> errors) {
        return errors.stream()
                .map(error -> error.getExtensions() == null ? null : error.getExtensions().get("code"))
                .filter(Objects::nonNull)
                .toList();
    }
}
