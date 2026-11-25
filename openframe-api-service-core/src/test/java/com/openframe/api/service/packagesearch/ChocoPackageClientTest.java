package com.openframe.api.service.packagesearch;

import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.api.dto.packagesearch.PackageSearchHit;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.dto.packagesearch.PackageVersion;
import com.openframe.api.exception.PackageNotFoundException;
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
class ChocoPackageClientTest {

    private static final String SEVEN_ZIP_CURSOR = "1|7zip|7-Zip";
    private static final String CHROME_CURSOR = "1|GoogleChrome|Google Chrome";

    @Mock
    private PackageCatalogRepository packageCatalogRepository;

    @InjectMocks
    private ChocoPackageClient client;

    @Test
    void getPackageManagerType_always_choco() {
        // setup
        PackageManagerType expected = PackageManagerType.CHOCO;

        // execution
        PackageManagerType type = client.getPackageManagerType();

        // verifications
        assertThat(type).isEqualTo(expected);
    }

    @Test
    void search_firstPage_hitsReadFromTheChocoCatalogInRepositoryOrder() {
        // setup
        PackageCatalogHit sevenZip = new PackageCatalogHit(entry("7zip", "7-Zip", "25.01"), SEVEN_ZIP_CURSOR);
        PackageCatalogHit chrome = new PackageCatalogHit(entry("GoogleChrome", "Google Chrome", "142.0.1"), CHROME_CURSOR);
        PackageCatalogPage page = new PackageCatalogPage(List.of(sevenZip, chrome), 8, true);
        when(packageCatalogRepository.searchByName(PackageManagerType.CHOCO, "", PackageCatalogOrder.BY_NAME, null, 2))
                .thenReturn(page);

        // execution
        PackageSearchResult result = client.search("", null, 2);

        // verifications
        assertThat(result.getHits())
                .extracting(PackageSearchHit::getCursor, hit -> hit.getItem().getId(), hit -> hit.getItem().getName(),
                        hit -> hit.getItem().getVersion(), hit -> hit.getItem().getPackageManager())
                .containsExactly(
                        tuple(SEVEN_ZIP_CURSOR, "7zip", "7-Zip", "25.01", PackageManagerType.CHOCO),
                        tuple(CHROME_CURSOR, "GoogleChrome", "Google Chrome", "142.0.1", PackageManagerType.CHOCO));
        assertThat(result.getTotal()).isEqualTo(8);
        assertThat(result.isHasMore()).isTrue();
    }

    @Test
    void search_hit_carriesDescriptionHomepageAndInstallCommand() {
        // setup
        PackageCatalogHit sevenZip = new PackageCatalogHit(entry("7zip", "7-Zip", "25.01"), SEVEN_ZIP_CURSOR);
        PackageCatalogPage page = new PackageCatalogPage(List.of(sevenZip), 1, false);
        when(packageCatalogRepository.searchByName(PackageManagerType.CHOCO, "7z", PackageCatalogOrder.BY_NAME, null, 25))
                .thenReturn(page);

        // execution
        PackageSearchResult result = client.search("7z", null, 25);

        // verifications
        assertThat(result.getHits())
                .extracting(hit -> hit.getItem().getDescription(), hit -> hit.getItem().getHomepage(),
                        hit -> hit.getItem().getInstallCommand())
                .containsExactly(tuple("7-Zip description", "https://example.org/7zip", "choco install 7zip"));
    }

    @Test
    void search_afterCursor_cursorHandedToRepositoryUnchanged() {
        // setup
        PackageCatalogHit chrome = new PackageCatalogHit(entry("GoogleChrome", "Google Chrome", "142.0.1"), CHROME_CURSOR);
        PackageCatalogPage page = new PackageCatalogPage(List.of(chrome), 8, false);
        when(packageCatalogRepository.searchByName(PackageManagerType.CHOCO, "o", PackageCatalogOrder.BY_NAME, SEVEN_ZIP_CURSOR, 5))
                .thenReturn(page);

        // execution
        PackageSearchResult result = client.search("o", SEVEN_ZIP_CURSOR, 5);

        // verifications
        assertThat(result.getHits())
                .extracting(hit -> hit.getItem().getId())
                .containsExactly("GoogleChrome");
        assertThat(result.isHasMore()).isFalse();
    }

    @Test
    void search_noMatches_emptyResultWithZeroTotal() {
        // setup
        PackageCatalogPage page = new PackageCatalogPage(List.of(), 0, false);
        when(packageCatalogRepository.searchByName(PackageManagerType.CHOCO, "nothing", PackageCatalogOrder.BY_NAME, null, 25))
                .thenReturn(page);

        // execution
        PackageSearchResult result = client.search("nothing", null, 25);

        // verifications
        assertThat(result.getHits()).isEmpty();
        assertThat(result.getTotal()).isZero();
        assertThat(result.isHasMore()).isFalse();
    }

    @Test
    void findPackage_idInAnotherCase_catalogEntryReturnedWithItsCanonicalId() {
        // setup
        PackageCatalogEntry chrome = entry("GoogleChrome", "Google Chrome", "142.0.1");
        when(packageCatalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.CHOCO, "googlechrome"))
                .thenReturn(List.of(chrome));

        // execution
        PackageDetails details = client.findPackage("googlechrome", null);

        // verifications
        assertThat(details)
                .extracting(PackageDetails::getId, PackageDetails::getPackageManager, PackageDetails::getName,
                        PackageDetails::getDescription, PackageDetails::getHomepage, PackageDetails::getInstallCommand)
                .containsExactly("GoogleChrome", PackageManagerType.CHOCO, "Google Chrome",
                        "Google Chrome description", "https://example.org/googlechrome", "choco install GoogleChrome");
        assertThat(details.getVersions())
                .extracting(PackageVersion::getVersion)
                .containsExactly("142.0.1");
    }

    @Test
    void findPackage_unknownId_throwsPackageNotFound() {
        // setup
        when(packageCatalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.CHOCO, "no-such")).thenReturn(List.of());

        // execution
        PackageNotFoundException ex = assertThrows(PackageNotFoundException.class, () -> client.findPackage("no-such", null));

        // verifications
        assertThat(ex.getMessage()).contains("no-such");
    }

    private static PackageCatalogEntry entry(String id, String name, String version) {
        return PackageCatalogEntry.builder()
                .id("CHOCO:" + id.toLowerCase())
                .manager(PackageManagerType.CHOCO)
                .packageId(id)
                .name(name)
                .description(name + " description")
                .homepage("https://example.org/" + id.toLowerCase())
                .version(version)
                .aliases(List.of())
                .build();
    }
}
