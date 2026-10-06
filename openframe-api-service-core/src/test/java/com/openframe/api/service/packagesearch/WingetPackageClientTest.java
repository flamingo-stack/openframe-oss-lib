package com.openframe.api.service.packagesearch;

import com.openframe.api.dto.packagesearch.PackageSearchItem;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.exception.PackageNotFoundException;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogPage;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WingetPackageClientTest {

    private static final Sort BY_NAME = Sort.by(Sort.Order.asc("name"), Sort.Order.asc("packageId"));

    @Mock
    private PackageCatalogRepository packageCatalogRepository;

    private WingetPackageClient client;

    @BeforeEach
    void setUp() {
        client = new WingetPackageClient(packageCatalogRepository, new PackageSearchProperties());
    }

    @Test
    void search_matchesFound_itemsKeepRepositoryOrderAndInstallCommands() {
        // setup
        PackageCatalogEntry firefox = entry("Mozilla.Firefox", "Mozilla Firefox");
        PackageCatalogEntry fork = entry("Mozilla.Firefox.ach", "Mozilla Firefox (ach)");
        PackageCatalogPage page = new PackageCatalogPage(List.of(firefox, fork), 2);
        when(packageCatalogRepository.searchByName(PackageManagerType.WINGET, "firefox", BY_NAME, 0, 2)).thenReturn(page);

        // execution
        PackageSearchResult result = client.search("firefox", 2, 0);

        // verifications
        assertThat(result.getItems())
                .extracting(PackageSearchItem::getId, PackageSearchItem::getInstallCommand, PackageSearchItem::getPublisher)
                .containsExactly(
                        tuple("Mozilla.Firefox", "winget install -e --id Mozilla.Firefox", "Mozilla"),
                        tuple("Mozilla.Firefox.ach", "winget install -e --id Mozilla.Firefox.ach", "Mozilla"));
        assertThat(result.getTotal()).isEqualTo(2);
        assertThat(result.isHasMore()).isFalse();
    }

    @Test
    void search_emptyQuery_wholeCatalogPagedByName() {
        // setup
        PackageCatalogEntry chrome = entry("Google.Chrome", "Google Chrome");
        PackageCatalogPage page = new PackageCatalogPage(List.of(chrome), 9000);
        when(packageCatalogRepository.searchByName(PackageManagerType.WINGET, "", BY_NAME, 0, 1)).thenReturn(page);

        // execution
        PackageSearchResult result = client.search("", 1, 0);

        // verifications
        assertThat(result.getItems())
                .extracting(PackageSearchItem::getId)
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
