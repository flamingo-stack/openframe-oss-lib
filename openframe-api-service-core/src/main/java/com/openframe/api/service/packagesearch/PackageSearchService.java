package com.openframe.api.service.packagesearch;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.api.dto.packagesearch.PackageSearchHit;
import com.openframe.api.dto.packagesearch.PackageSearchItem;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toUnmodifiableMap;
import static org.springframework.util.StringUtils.hasText;

@Service
public class PackageSearchService {

    // Chocolatey's server caps a page at 40 entries and we fetch one extra row there to compute
    // hasMore exactly, so a page is at most 39; a uniform cap keeps paging identical across managers.
    private static final int MAX_LIMIT = 39;
    private static final int DEFAULT_LIMIT = 25;

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
        if (pagination.isBackward()) {
            throw new IllegalArgumentException("package search pages forward only: use first/after");
        }
        String search = rawSearch == null ? "" : rawSearch.trim();
        int limit = clamp(pagination.getLimit());
        String afterCursor = pagination.getCursor();

        PackageManagerClient client = clientFor(packageManager);
        PackageSearchResult result = client.search(search, afterCursor, limit);
        return toConnection(result, pagination);
    }

    public PackageDetails findPackage(PackageManagerType packageManager, String packageId, BrewPackageType packageType) {
        if (!hasText(packageId)) {
            throw new IllegalArgumentException("packageId must not be blank");
        }
        String id = packageId.trim();
        PackageManagerClient client = clientFor(packageManager);
        return client.findPackage(id, packageType);
    }

    private CountedGenericConnection<GenericEdge<PackageSearchItem>> toConnection(PackageSearchResult result,
                                                                                 CursorPaginationCriteria pagination) {
        List<GenericEdge<PackageSearchItem>> edges = result.getHits().stream()
                .map(PackageSearchService::toEdge)
                .toList();
        String startCursor = edges.isEmpty() ? null : edges.getFirst().getCursor();
        String endCursor = edges.isEmpty() ? null : edges.getLast().getCursor();
        PageInfo pageInfo = PageInfo.builder()
                .hasNextPage(result.isHasMore())
                .hasPreviousPage(pagination.hasCursor())
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
        return CountedGenericConnection.<GenericEdge<PackageSearchItem>>builder()
                .edges(edges)
                .pageInfo(pageInfo)
                .filteredCount(result.getTotal())
                .build();
    }

    private static GenericEdge<PackageSearchItem> toEdge(PackageSearchHit hit) {
        String cursor = CursorCodec.encode(hit.getCursor());
        return GenericEdge.<PackageSearchItem>builder()
                .node(hit.getItem())
                .cursor(cursor)
                .build();
    }

    private static int clamp(Integer requested) {
        return requested == null ? DEFAULT_LIMIT : Math.clamp(requested, 1, MAX_LIMIT);
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
}
