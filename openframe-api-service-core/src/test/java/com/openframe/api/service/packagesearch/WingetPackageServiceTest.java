package com.openframe.api.service.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import com.openframe.api.service.packagesearch.PackageSearchProperties;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.exception.PackageNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WingetPackageServiceTest {

    private PackageCatalogRepository packageCatalogRepository;
    private WingetPackageService service;

    @BeforeEach
    void setUp() {
        packageCatalogRepository = mock(PackageCatalogRepository.class);
        service = new WingetPackageService(packageCatalogRepository, new PackageSearchProperties());
    }

    @Test
    void canonicalPackageOutranksLocaleForksOnSharedMoniker() {
        PackageCatalogEntry canonical = entry("Mozilla.Firefox", "Mozilla Firefox (en-US)");
        PackageCatalogEntry localeFork = entry("Mozilla.Firefox.ach", "Mozilla Firefox (ach)");
        when(packageCatalogRepository.findByManagerAndSearchBlobContaining("WINGET", "firefox")).thenReturn(List.of(localeFork, canonical));

        PackageSearchResult result = service.search("firefox", 2, 0);

        assertEquals("Mozilla.Firefox", result.getItems().getFirst().getId());
    }

    @Test
    void findPackageThrowsWhenUnknown() {
        when(packageCatalogRepository.findByManagerAndPackageIdIgnoreCase("WINGET", "No.Such")).thenReturn(List.of());

        assertThrows(PackageNotFoundException.class, () -> service.findPackage("No.Such", null));
    }

    private static PackageCatalogEntry entry(String id, String name) {
        return PackageCatalogEntry.builder()
                .id("WINGET:" + id.toLowerCase())
                .manager("WINGET")
                .packageId(id)
                .name(name)
                .version("154.0.1")
                .publisher("Mozilla")
                .aliases(List.of("firefox"))
                .build();
    }
}
