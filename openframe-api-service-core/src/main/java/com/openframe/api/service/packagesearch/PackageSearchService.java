package com.openframe.api.service.packagesearch;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.api.dto.packagesearch.PackageSearchItem;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toUnmodifiableMap;
import static org.springframework.util.StringUtils.hasText;

@Service
public class PackageSearchService {

    // Chocolatey's server caps a page at 40 entries and we fetch one extra row there to compute
    // hasMore exactly, so a page is at most 39; a uniform cap keeps paging identical across managers.
    private static final int MAX_LIMIT = 39;
    private static final int DEFAULT_LIMIT = 25;
    private static final int MIN_QUERY_LENGTH = 2;

    private final Map<PackageManagerType, PackageManagerClient> clients;
    private final PackageManagerProperties packageManagerProperties;

    public PackageSearchService(List<PackageManagerClient> clientList,
                                PackageManagerProperties packageManagerProperties) {
        this.clients = clientList.stream()
                .collect(toUnmodifiableMap(PackageManagerClient::getPackageManagerType, identity()));
        this.packageManagerProperties = packageManagerProperties;
    }

    public CountedGenericConnection<GenericEdge<PackageSearchItem>> search(
            PackageManagerType packageManager, String rawSearch, CursorPaginationCriteria pagination) {
        String search = rawSearch == null ? "" : rawSearch.trim();
        if (search.length() < MIN_QUERY_LENGTH) {
            throw new IllegalArgumentException("search must be at least " + MIN_QUERY_LENGTH + " characters long");
        }
        Page page = resolvePage(pagination);

        PackageManagerClient client = clientFor(packageManager);
        PackageSearchResult result = client.search(search, page.getLimit(), page.getStartIndex());
        return toConnection(result, page);
    }

    public PackageDetails findPackage(PackageManagerType packageManager, String packageId, BrewPackageType packageType) {
        if (!hasText(packageId)) {
            throw new IllegalArgumentException("packageId must not be blank");
        }
        String id = packageId.trim();
        PackageManagerClient client = clientFor(packageManager);
        return client.findPackage(id, packageType);
    }

    // offset math is source-specific (brew/winget rank in-memory, choco is external $skip), so it stays
    // here; direction and cursor decoding are the shared CursorPaginationCriteria.
    private Page resolvePage(CursorPaginationCriteria pagination) {
        int cursorIndex = indexOf(pagination.getCursor());
        if (pagination.isBackward()) {
            int size = clamp(pagination.getLimit());
            int startIndex = Math.max(0, cursorIndex - size);
            return new Page(startIndex, cursorIndex - startIndex, true);
        }
        int startIndex = pagination.hasCursor() ? cursorIndex + 1 : 0;
        return new Page(startIndex, clamp(pagination.getLimit()), false);
    }

    private CountedGenericConnection<GenericEdge<PackageSearchItem>> toConnection(PackageSearchResult result, Page page) {
        List<GenericEdge<PackageSearchItem>> edges = buildEdges(result.getItems(), page.getStartIndex());
        String startCursor = edges.isEmpty() ? null : edges.getFirst().getCursor();
        String endCursor = edges.isEmpty() ? null : edges.getLast().getCursor();
        PageInfo pageInfo = PageInfo.builder()
                .hasNextPage(page.isBackward() || result.isHasMore())
                .hasPreviousPage(page.getStartIndex() > 0)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
        return CountedGenericConnection.<GenericEdge<PackageSearchItem>>builder()
                .edges(edges)
                .pageInfo(pageInfo)
                .filteredCount(result.getTotal())
                .build();
    }

    private static List<GenericEdge<PackageSearchItem>> buildEdges(List<PackageSearchItem> items, int startIndex) {
        return IntStream.range(0, items.size())
                .mapToObj(i -> GenericEdge.<PackageSearchItem>builder()
                        .node(items.get(i))
                        .cursor(CursorCodec.encode(String.valueOf(startIndex + i)))
                        .build())
                .toList();
    }

    private static int clamp(Integer requested) {
        return requested == null ? DEFAULT_LIMIT : Math.clamp(requested, 1, MAX_LIMIT);
    }

    // the decoded cursor is the item's 0-based index; a missing/tampered one falls back to the
    // boundary (index 0), the repo-wide cursor convention
    private static int indexOf(String decodedCursor) {
        if (decodedCursor == null) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(decodedCursor));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private PackageManagerClient clientFor(PackageManagerType packageManager) {
        if (packageManagerProperties.isDisabled(packageManager)) {
            throw new IllegalArgumentException("package manager " + packageManager + " is currently disabled");
        }
        PackageManagerClient client = clients.get(packageManager);
        if (client == null) {
            throw new IllegalStateException("no package manager client registered for " + packageManager);
        }
        return client;
    }

    @Getter
    @AllArgsConstructor
    private static final class Page {
        private final int startIndex;
        private final int limit;
        private final boolean backward;
    }
}
