package com.openframe.api.service.packagesearch;

import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.api.dto.packagesearch.PackageSearchHit;
import com.openframe.api.dto.packagesearch.PackageSearchItem;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.exception.PackageNotFoundException;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogHit;
import com.openframe.data.repository.packagesearch.PackageCatalogOrder;
import com.openframe.data.repository.packagesearch.PackageCatalogPage;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BrewPackageClientTest {

    private static final String SLACK_CURSOR = "3|slack|7594";
    private static final String SLACK_CLI_CURSOR = "2|slack-cli|791";

    @Mock
    private PackageCatalogRepository packageCatalogRepository;

    @InjectMocks
    private BrewPackageClient client;

    @Test
    void search_firstPage_hitsKeepRepositoryOrderCursorsAndInstallCommands() {
        // setup
        PackageCatalogHit slack = new PackageCatalogHit(caskEntry("slack", "Slack", 7594), SLACK_CURSOR);
        PackageCatalogHit slackCli = new PackageCatalogHit(formulaEntry("slack-cli", "Slack CLI", 791), SLACK_CLI_CURSOR);
        PackageCatalogPage page = new PackageCatalogPage(List.of(slack, slackCli), 9, true);
        when(packageCatalogRepository.searchByName(PackageManagerType.BREW, "slack", PackageCatalogOrder.MOST_POPULAR_FIRST, null, 2))
                .thenReturn(page);

        // execution
        PackageSearchResult result = client.search("slack", null, 2);

        // verifications
        assertThat(result.getHits())
                .extracting(PackageSearchHit::getCursor, hit -> hit.getItem().getId(), hit -> hit.getItem().getInstallCommand())
                .containsExactly(
                        tuple(SLACK_CURSOR, "slack", "brew install --cask slack"),
                        tuple(SLACK_CLI_CURSOR, "slack-cli", "brew install slack-cli"));
        assertThat(result.getTotal()).isEqualTo(9);
        assertThat(result.isHasMore()).isTrue();
    }

    @Test
    void search_afterCursor_cursorHandedToRepositoryUnchanged() {
        // setup
        PackageCatalogHit slackCli = new PackageCatalogHit(formulaEntry("slack-cli", "Slack CLI", 791), SLACK_CLI_CURSOR);
        PackageCatalogPage page = new PackageCatalogPage(List.of(slackCli), 9, false);
        when(packageCatalogRepository.searchByName(PackageManagerType.BREW, "slack", PackageCatalogOrder.MOST_POPULAR_FIRST, SLACK_CURSOR, 5))
                .thenReturn(page);

        // execution
        PackageSearchResult result = client.search("slack", SLACK_CURSOR, 5);

        // verifications
        assertThat(result.getHits())
                .extracting(hit -> hit.getItem().getId())
                .containsExactly("slack-cli");
        assertThat(result.isHasMore()).isFalse();
    }

    @Test
    void search_emptyQuery_wholeCatalogRequestedMostPopularFirst() {
        // setup
        PackageCatalogHit gh = new PackageCatalogHit(formulaEntry("gh", "gh", 90000), "2|gh|90000");
        PackageCatalogPage page = new PackageCatalogPage(List.of(gh), 15323, true);
        when(packageCatalogRepository.searchByName(PackageManagerType.BREW, "", PackageCatalogOrder.MOST_POPULAR_FIRST, null, 1))
                .thenReturn(page);

        // execution
        PackageSearchResult result = client.search("", null, 1);

        // verifications
        assertThat(result.getHits())
                .extracting(hit -> hit.getItem().getPackageManager())
                .containsExactly(PackageManagerType.BREW);
        assertThat(result.getTotal()).isEqualTo(15323);
        assertThat(result.isHasMore()).isTrue();
    }

    @Test
    void search_noMatches_emptyResultWithZeroTotal() {
        // setup
        PackageCatalogPage page = new PackageCatalogPage(List.of(), 0, false);
        when(packageCatalogRepository.searchByName(PackageManagerType.BREW, "nothing", PackageCatalogOrder.MOST_POPULAR_FIRST, null, 25))
                .thenReturn(page);

        // execution
        PackageSearchResult result = client.search("nothing", null, 25);

        // verifications
        assertThat(result.getHits()).isEmpty();
        assertThat(result.getTotal()).isZero();
        assertThat(result.isHasMore()).isFalse();
    }

    @Test
    void findPackage_typeAbsent_formulaPreferred() {
        // setup
        PackageCatalogEntry formula = formulaEntry("wireshark", "wireshark", 100);
        PackageCatalogEntry cask = caskEntry("wireshark", "Wireshark", 50);
        when(packageCatalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.BREW, "wireshark"))
                .thenReturn(List.of(cask, formula));

        // execution
        PackageDetails details = client.findPackage("wireshark", null);

        // verifications
        assertThat(details.getPackageType()).isEqualTo(BrewPackageType.FORMULA);
        assertThat(details.getInstallCommand()).isEqualTo("brew install wireshark");
    }

    @Test
    void findPackage_caskRequested_caskReturned() {
        // setup
        PackageCatalogEntry cask = caskEntry("slack", "Slack", 7594);
        PackageCatalogEntry formulaTwin = formulaEntry("slack", "slack", 1);
        when(packageCatalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.BREW, "slack"))
                .thenReturn(List.of(formulaTwin, cask));

        // execution
        PackageDetails details = client.findPackage("slack", BrewPackageType.CASK);

        // verifications
        assertThat(details.getPackageType()).isEqualTo(BrewPackageType.CASK);
        assertThat(details.getInstallCommand()).isEqualTo("brew install --cask slack");
    }

    @Test
    void findPackage_unknownId_throwsPackageNotFound() {
        // setup
        when(packageCatalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.BREW, "nope")).thenReturn(List.of());

        // execution
        PackageNotFoundException ex = assertThrows(PackageNotFoundException.class, () -> client.findPackage("nope", null));

        // verifications
        assertThat(ex.getMessage()).contains("nope");
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
