package com.openframe.api.service.packagesearch;

import com.openframe.api.dto.packagesearch.PackageSearchHit;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.exception.PackageNotFoundException;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogHit;
import com.openframe.data.repository.packagesearch.PackageCatalogOrder;
import com.openframe.data.repository.packagesearch.PackageCatalogPage;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WingetPackageClientTest {

    private static final String FIREFOX_CURSOR = "1|Mozilla.Firefox|Mozilla Firefox";

    @Mock
    private PackageCatalogRepository packageCatalogRepository;

    private WingetPackageClient client;

    @BeforeEach
    void setUp() {
        client = new WingetPackageClient(packageCatalogRepository, new PackageSearchProperties());
    }

    @Test
    void search_firstPage_hitsKeepRepositoryOrderCursorsAndInstallCommands() {
        // setup
        PackageCatalogHit firefox = new PackageCatalogHit(entry("Mozilla.Firefox", "Mozilla Firefox"), FIREFOX_CURSOR);
        PackageCatalogHit fork = new PackageCatalogHit(entry("Mozilla.Firefox.ach", "Mozilla Firefox (ach)"), "1|Mozilla.Firefox.ach|Mozilla Firefox (ach)");
        PackageCatalogPage page = new PackageCatalogPage(List.of(firefox, fork), 2, false);
        when(packageCatalogRepository.searchByName(PackageManagerType.WINGET, "firefox", PackageCatalogOrder.BY_NAME, null, 2))
                .thenReturn(page);

        // execution
        PackageSearchResult result = client.search("firefox", null, 2);

        // verifications
        assertThat(result.getHits())
                .extracting(PackageSearchHit::getCursor, hit -> hit.getItem().getInstallCommand(), hit -> hit.getItem().getPublisher())
                .containsExactly(
                        tuple(FIREFOX_CURSOR, "winget install -e --id Mozilla.Firefox", "Mozilla"),
                        tuple("1|Mozilla.Firefox.ach|Mozilla Firefox (ach)", "winget install -e --id Mozilla.Firefox.ach", "Mozilla"));
        assertThat(result.getTotal()).isEqualTo(2);
        assertThat(result.isHasMore()).isFalse();
    }

    @Test
    void search_emptyQueryAfterCursor_byNameOrderAndCursorHandedToRepository() {
        // setup
        PackageCatalogHit chrome = new PackageCatalogHit(entry("Google.Chrome", "Google Chrome"), "2|Google.Chrome|Google Chrome");
        PackageCatalogPage page = new PackageCatalogPage(List.of(chrome), 9000, true);
        when(packageCatalogRepository.searchByName(PackageManagerType.WINGET, "", PackageCatalogOrder.BY_NAME, FIREFOX_CURSOR, 1))
                .thenReturn(page);

        // execution
        PackageSearchResult result = client.search("", FIREFOX_CURSOR, 1);

        // verifications
        assertThat(result.getHits())
                .extracting(hit -> hit.getItem().getId())
                .containsExactly("Google.Chrome");
        assertThat(result.getTotal()).isEqualTo(9000);
        assertThat(result.isHasMore()).isTrue();
    }

    @Test
    void findPackage_unknownId_throwsPackageNotFound() {
        // setup
        when(packageCatalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.WINGET, "No.Such")).thenReturn(List.of());

        // execution
        PackageNotFoundException ex = assertThrows(PackageNotFoundException.class, () -> client.findPackage("No.Such", null));

        // verifications
        assertThat(ex.getMessage()).contains("No.Such");
    }

    private static PackageCatalogEntry entry(String id, String name) {
        return PackageCatalogEntry.builder()
                .id("WINGET:" + id.toLowerCase())
                .manager(PackageManagerType.WINGET)
                .packageId(id)
                .name(name)
                .version("154.0.1")
                .publisher("Mozilla")
                .aliases(List.of("firefox"))
                .build();
    }
}
