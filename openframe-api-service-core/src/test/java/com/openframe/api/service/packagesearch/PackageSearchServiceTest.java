package com.openframe.api.service.packagesearch;

import com.openframe.api.dto.packagesearch.PackageSearchConnection;
import com.openframe.api.dto.packagesearch.PackageSearchItem;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PackageSearchServiceTest {

    private PackageManagerClient brewClient;
    private PackageManagerClient chocoClient;
    private PackageManagerClient wingetClient;
    private PackageManagerProperties packageManagerProperties;
    private PackageSearchService service;

    @BeforeEach
    void setUp() {
        brewClient = clientFor(PackageManagerType.BREW);
        chocoClient = clientFor(PackageManagerType.CHOCO);
        wingetClient = clientFor(PackageManagerType.WINGET);
        packageManagerProperties = new PackageManagerProperties();
        packageManagerProperties.setChocoEnabled(true);
        service = new PackageSearchService(List.of(brewClient, chocoClient, wingetClient), packageManagerProperties);
    }

    private static PackageSearchResult resultOf(int count, boolean hasMore, int total) {
        List<PackageSearchItem> items = java.util.stream.IntStream.range(0, count)
                .mapToObj(i -> PackageSearchItem.builder().id("pkg-" + i).name("pkg-" + i).build())
                .toList();
        return PackageSearchResult.builder().items(items).hasMore(hasMore).total(total).build();
    }

    @Test
    void rejectsShortQuery() {
        assertThrows(IllegalArgumentException.class, () -> service.search(PackageManagerType.BREW, " a ", null, null));
        verify(brewClient, never()).search(anyString(), anyInt(), anyInt());
    }

    @Test
    void appliesDefaultsAndRoutesToBrew() {
        when(brewClient.search(eq("slack"), anyInt(), anyInt())).thenReturn(resultOf(2, false, 2));

        service.search(PackageManagerType.BREW, " slack ", null, null);

        verify(brewClient).search("slack", 25, 0);
    }

    @Test
    void clampsFirstToMax() {
        when(wingetClient.search(eq("slack"), anyInt(), anyInt())).thenReturn(resultOf(1, false, 1));

        service.search(PackageManagerType.WINGET, "slack", 500, null);

        verify(wingetClient).search("slack", 39, 0);
    }

    @Test
    void mapsResultToConnectionAndCursors() {
        when(brewClient.search(eq("slack"), anyInt(), anyInt())).thenReturn(resultOf(3, true, 42));

        PackageSearchConnection connection = service.search(PackageManagerType.BREW, "slack", 3, null);

        assertThat(connection.getEdges()).hasSize(3);
        assertThat(connection.getFilteredCount()).isEqualTo(42);
        assertThat(connection.getPageInfo().isHasNextPage()).isTrue();
        assertThat(connection.getPageInfo().isHasPreviousPage()).isFalse();
        // cursors encode 1-based positions after the row; endCursor drives the next page
        assertThat(CursorCodec.decode(connection.getEdges().getFirst().getCursor())).isEqualTo("1");
        assertThat(CursorCodec.decode(connection.getPageInfo().getEndCursor())).isEqualTo("3");
    }

    @Test
    void afterCursorContinuesFromEncodedOffset() {
        String after = CursorCodec.encode("3");
        when(brewClient.search(eq("slack"), anyInt(), anyInt())).thenReturn(resultOf(2, false, 5));

        PackageSearchConnection connection = service.search(PackageManagerType.BREW, "slack", 3, after);

        verify(brewClient).search("slack", 3, 3);
        assertThat(connection.getPageInfo().isHasPreviousPage()).isTrue();
        assertThat(CursorCodec.decode(connection.getEdges().getFirst().getCursor())).isEqualTo("4");
    }

    @Test
    void rejectsSearchForDisabledManager() {
        packageManagerProperties.setChocoEnabled(false);

        assertThrows(IllegalArgumentException.class,
                () -> service.search(PackageManagerType.CHOCO, "slack", null, null));
        verify(chocoClient, never()).search(anyString(), anyInt(), anyInt());
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
