package com.openframe.packagesearch.api;

import com.openframe.packagesearch.PackageCatalogEntry;
import com.openframe.packagesearch.api.PackageSearchProperties;
import com.openframe.packagesearch.PackageManagerType;
import com.openframe.packagesearch.api.dto.PackageSearchResult;
import com.openframe.packagesearch.api.PackageNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WingetPackageServiceTest {

    private PackageCatalogReader catalogReader;
    private WingetPackageService service;

    @BeforeEach
    void setUp() {
        catalogReader = mock(PackageCatalogReader.class);
        service = new WingetPackageService(catalogReader, new PackageSearchProperties());
    }

    @Test
    void canonicalPackageOutranksLocaleForksOnSharedMoniker() {
        PackageCatalogEntry canonical = entry("Mozilla.Firefox", "Mozilla Firefox (en-US)");
        PackageCatalogEntry localeFork = entry("Mozilla.Firefox.ach", "Mozilla Firefox (ach)");
        when(catalogReader.findCandidates(PackageManagerType.WINGET, "firefox")).thenReturn(List.of(localeFork, canonical));

        PackageSearchResult result = service.search("firefox", 2, 0);

        assertEquals("Mozilla.Firefox", result.getItems().getFirst().getId());
    }

    @Test
    void findPackageThrowsWhenUnknown() {
        when(catalogReader.findByEntryIds(List.of("WINGET:no.such"))).thenReturn(List.of());

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
