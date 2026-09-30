package com.openframe.api.service.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import com.openframe.api.service.packagesearch.PackageSearchProperties;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.exception.PackageNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WingetPackageClientTest {

    private PackageCatalogRepository packageCatalogRepository;
    private WingetPackageClient client;

    @BeforeEach
    void setUp() {
        packageCatalogRepository = mock(PackageCatalogRepository.class);
        client = new WingetPackageClient(packageCatalogRepository, new PackageSearchProperties());
    }

    @Test
    void canonicalPackageOutranksLocaleForksOnSharedMoniker() {
        PackageCatalogEntry canonical = entry("Mozilla.Firefox", "Mozilla Firefox (en-US)");
        PackageCatalogEntry localeFork = entry("Mozilla.Firefox.ach", "Mozilla Firefox (ach)");
        when(packageCatalogRepository.findByManagerAndSearchBlobContaining(PackageManagerType.WINGET, "firefox")).thenReturn(List.of(localeFork, canonical));

        PackageSearchResult result = client.search("firefox", 2, 0);

        assertEquals("Mozilla.Firefox", result.getItems().getFirst().getId());
    }

    @Test
    void emptyQueryPagesTheCatalogByNameWithoutScoring() {
        // setup
        Sort byName = Sort.by(Sort.Order.asc("name"), Sort.Order.asc("packageId"));
        PackageCatalogEntry chrome = entry("Google.Chrome", "Google Chrome");
        when(packageCatalogRepository.listByManager(PackageManagerType.WINGET, byName, 0, 1)).thenReturn(List.of(chrome));
        when(packageCatalogRepository.countByManager(PackageManagerType.WINGET)).thenReturn(1L);

        // execution
        PackageSearchResult result = client.search("", 1, 0);

        // verifications
        assertEquals("Google.Chrome", result.getItems().getFirst().getId());
        assertEquals(1, result.getTotal());
        assertFalse(result.isHasMore());
        verify(packageCatalogRepository, never()).findByManagerAndSearchBlobContaining(PackageManagerType.WINGET, "");
    }

    @Test
    void findPackageThrowsWhenUnknown() {
        when(packageCatalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.WINGET, "No.Such")).thenReturn(List.of());

        assertThrows(PackageNotFoundException.class, () -> client.findPackage("No.Such", null));
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
