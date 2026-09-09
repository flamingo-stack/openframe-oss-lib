package com.openframe.api.service.packagesearch;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.api.dto.packagesearch.PackageSearchInput;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PackageSearchServiceTest {

    private PackageManagerClient brewClient;
    private PackageManagerClient chocoClient;
    private PackageManagerClient wingetClient;
    private PackageSearchService service;

    @BeforeEach
    void setUp() {
        brewClient = clientFor(PackageManagerType.BREW);
        chocoClient = clientFor(PackageManagerType.CHOCO);
        wingetClient = clientFor(PackageManagerType.WINGET);
        service = new PackageSearchService(List.of(brewClient, chocoClient, wingetClient));
    }

    @Test
    void rejectsShortQuery() {
        PackageSearchInput input = new PackageSearchInput(PackageManagerType.BREW, " a ", null, null);

        assertThrows(IllegalArgumentException.class, () -> service.search(input));
        verify(brewClient, never()).search(anyString(), anyInt(), anyInt());
    }

    @Test
    void appliesDefaultsAndRoutesToBrew() {
        service.search(new PackageSearchInput(PackageManagerType.BREW, " slack ", null, null));

        verify(brewClient).search("slack", 25, 0);
    }

    @Test
    void clampsLimitAndOffset() {
        service.search(new PackageSearchInput(PackageManagerType.CHOCO, "slack", 500, -5));

        verify(chocoClient).search("slack", 39, 0);
    }

    @Test
    void routesFindPackageAndTrimsId() {
        service.findPackage(PackageManagerType.WINGET, " Mozilla.Firefox ", null);

        verify(wingetClient).findPackage("Mozilla.Firefox", null);
    }

    @Test
    void rejectsBlankPackageId() {
        assertThrows(IllegalArgumentException.class,
                () -> service.findPackage(PackageManagerType.BREW, "  ", null));
    }

    private static PackageManagerClient clientFor(PackageManagerType type) {
        PackageManagerClient client = mock(PackageManagerClient.class);
        when(client.getPackageManagerType()).thenReturn(type);
        return client;
    }
}
