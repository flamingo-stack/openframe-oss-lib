package com.openframe.api.service.packagesearch;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.packagesearch.PackageSearchHit;
import com.openframe.api.dto.packagesearch.PackageSearchItem;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageSearchServiceTest {

    private static final String RAW_CURSOR = "3|slack|7594";

    @Mock
    private PackageManagerClient brewClient;
    @Mock
    private PackageManagerClient chocoClient;
    @Mock
    private PackageManagerClient wingetClient;

    private PackageManagerProperties packageManagerProperties;

    @BeforeEach
    void setUp() {
        packageManagerProperties = new PackageManagerProperties();
        packageManagerProperties.setChocoEnabled(true);
    }

    @Test
    void search_blankAndSingleCharacterSearch_passedThroughTrimmed() {
        // setup
        PackageSearchService service = newService();
        when(brewClient.search(anyString(), isNull(), anyInt())).thenReturn(resultOf(2, false, 2));

        // execution
        service.search(PackageManagerType.BREW, null, forward(null, null));
        service.search(PackageManagerType.BREW, " a ", forward(null, null));

        // verifications
        verify(brewClient).search("", null, 25);
        verify(brewClient).search("a", null, 25);
    }

    @Test
    void search_firstAboveMaximum_clampedToThirtyNine() {
        // setup
        PackageSearchService service = newService();
        when(wingetClient.search("slack", null, 39)).thenReturn(resultOf(1, false, 1));

        // execution
        service.search(PackageManagerType.WINGET, "slack", forward(500, null));

        // verifications
        verify(wingetClient).search("slack", null, 39);
    }

    @Test
    void search_firstPage_edgesCarryEncodedClientCursorsAndTotal() {
        // setup
        PackageSearchService service = newService();
        when(brewClient.search("slack", null, 3)).thenReturn(resultOf(3, true, 42));

        // execution
        CountedGenericConnection<GenericEdge<PackageSearchItem>> connection =
                service.search(PackageManagerType.BREW, "slack", forward(3, null));

        // verifications
        assertThat(connection.getEdges())
                .extracting(edge -> CursorCodec.decode(edge.getCursor()))
                .containsExactly("cursor-0", "cursor-1", "cursor-2");
        assertThat(connection.getFilteredCount()).isEqualTo(42);
        assertThat(connection.getPageInfo().isHasNextPage()).isTrue();
        assertThat(connection.getPageInfo().isHasPreviousPage()).isFalse();
        assertThat(CursorCodec.decode(connection.getPageInfo().getStartCursor())).isEqualTo("cursor-0");
        assertThat(CursorCodec.decode(connection.getPageInfo().getEndCursor())).isEqualTo("cursor-2");
    }

    @Test
    void search_afterCursor_decodedCursorHandedToClientAndPreviousPageFlagged() {
        // setup
        PackageSearchService service = newService();
        String after = CursorCodec.encode(RAW_CURSOR);
        when(brewClient.search("slack", RAW_CURSOR, 3)).thenReturn(resultOf(2, false, 5));

        // execution
        CountedGenericConnection<GenericEdge<PackageSearchItem>> connection =
                service.search(PackageManagerType.BREW, "slack", forward(3, after));

        // verifications
        assertThat(connection.getPageInfo().isHasPreviousPage()).isTrue();
        assertThat(connection.getPageInfo().isHasNextPage()).isFalse();
    }

    @Test
    void search_emptyPage_noCursorsAndZeroEdges() {
        // setup
        PackageSearchService service = newService();
        when(brewClient.search("nothing", null, 25)).thenReturn(resultOf(0, false, 0));

        // execution
        CountedGenericConnection<GenericEdge<PackageSearchItem>> connection =
                service.search(PackageManagerType.BREW, "nothing", forward(null, null));

        // verifications
        assertThat(connection.getEdges()).isEmpty();
        assertThat(connection.getPageInfo().getStartCursor()).isNull();
        assertThat(connection.getPageInfo().getEndCursor()).isNull();
    }

    @Test
    void search_lastBefore_rejected() {
        // setup
        PackageSearchService service = newService();
        CursorPaginationCriteria backward = backward(3, CursorCodec.encode(RAW_CURSOR));

        // execution
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.search(PackageManagerType.BREW, "slack", backward));

        // verifications
        assertThat(ex.getMessage()).contains("forward only");
        verify(brewClient, never()).search(anyString(), anyString(), anyInt());
    }

    @Test
    void search_disabledManager_rejected() {
        // setup
        PackageSearchService service = newService();
        packageManagerProperties.setChocoEnabled(false);
        CursorPaginationCriteria firstPage = forward(null, null);

        // execution
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.search(PackageManagerType.CHOCO, "slack", firstPage));

        // verifications
        assertThat(ex.getMessage()).contains("disabled");
        verify(chocoClient, never()).search(anyString(), isNull(), anyInt());
    }

    @Test
    void findPackage_paddedId_trimmedAndRouted() {
        // setup
        PackageSearchService service = newService();

        // execution
        service.findPackage(PackageManagerType.WINGET, " Mozilla.Firefox ", null);

        // verifications
        verify(wingetClient).findPackage("Mozilla.Firefox", null);
    }

    @Test
    void findPackage_blankId_rejected() {
        // setup
        PackageSearchService service = newService();

        // execution
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.findPackage(PackageManagerType.BREW, "  ", null));

        // verifications
        assertThat(ex.getMessage()).contains("packageId");
    }

    private PackageSearchService newService() {
        when(brewClient.getPackageManagerType()).thenReturn(PackageManagerType.BREW);
        when(chocoClient.getPackageManagerType()).thenReturn(PackageManagerType.CHOCO);
        when(wingetClient.getPackageManagerType()).thenReturn(PackageManagerType.WINGET);
        return new PackageSearchService(List.of(brewClient, chocoClient, wingetClient), packageManagerProperties);
    }

    private static CursorPaginationCriteria forward(Integer first, String after) {
        ConnectionArgs args = ConnectionArgs.builder().first(first).after(after).build();
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    private static CursorPaginationCriteria backward(Integer last, String before) {
        ConnectionArgs args = ConnectionArgs.builder().last(last).before(before).build();
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    private static PackageSearchResult resultOf(int count, boolean hasMore, int total) {
        List<PackageSearchHit> hits = IntStream.range(0, count)
                .mapToObj(PackageSearchServiceTest::hit)
                .toList();
        return PackageSearchResult.builder().hits(hits).hasMore(hasMore).total(total).build();
    }

    private static PackageSearchHit hit(int index) {
        PackageSearchItem item = PackageSearchItem.builder().id("pkg-" + index).name("pkg-" + index).build();
        return new PackageSearchHit(item, "cursor-" + index);
    }
}
