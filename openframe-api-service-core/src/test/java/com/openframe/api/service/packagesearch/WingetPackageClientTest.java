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
import static org.mockito.ArgumentMatchers.any;
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
    void emptyQueryListsAlphabetically() {
        PackageCatalogEntry sevenZip = entry("7zip.7zip", "7-Zip");
        PackageCatalogEntry firefox = entry("Mozilla.Firefox", "Mozilla Firefox (en-US)");
        Sort byName = Sort.by(Sort.Order.asc("name"), Sort.Order.asc("packageId"));
        when(packageCatalogRepository.listByManager(PackageManagerType.WINGET, byName, 0, 25)).thenReturn(List.of(sevenZip, firefox));
        when(packageCatalogRepository.countByManager(PackageManagerType.WINGET)).thenReturn(2L);

        PackageSearchResult result = client.search("", 25, 0);

        assertEquals("7zip.7zip", result.getItems().getFirst().getId());
        assertEquals(2, result.getTotal());
        assertFalse(result.isHasMore());
        verify(packageCatalogRepository, never()).findByManagerAndSearchBlobContaining(any(), any());
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
