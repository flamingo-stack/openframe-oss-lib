package com.openframe.api.service.packagesearch;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.api.dto.packagesearch.PackageSearchConnection;
import com.openframe.api.dto.packagesearch.PackageSearchItem;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.data.config.PackageManagerProperties;
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
    private static final int MIN_QUERY_LENGTH = 2;

    private final Map<PackageManagerType, PackageManagerClient> clients;
    private final PackageManagerProperties packageManagerProperties;

    public PackageSearchService(List<PackageManagerClient> clientList,
                                PackageManagerProperties packageManagerProperties) {
        this.clients = clientList.stream()
                .collect(toUnmodifiableMap(PackageManagerClient::getPackageManagerType, identity()));
        this.packageManagerProperties = packageManagerProperties;
    }

    public PackageSearchConnection search(PackageManagerType packageManager, String rawQuery, Integer first, String after) {
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.length() < MIN_QUERY_LENGTH) {
            throw new IllegalArgumentException("query must be at least " + MIN_QUERY_LENGTH + " characters long");
        }
        int limit = first == null ? DEFAULT_LIMIT : Math.clamp(first, 1, MAX_LIMIT);
        int offset = offsetFrom(after);

        PackageManagerClient client = clientFor(packageManager);
        PackageSearchResult result = client.search(query, limit, offset);
        return toConnection(result, offset);
    }

    public PackageDetails findPackage(PackageManagerType packageManager, String packageId, BrewPackageType packageType) {
        if (!hasText(packageId)) {
            throw new IllegalArgumentException("packageId must not be blank");
        }
        String id = packageId.trim();
        PackageManagerClient client = clientFor(packageManager);
        return client.findPackage(id, packageType);
    }

    private PackageSearchConnection toConnection(PackageSearchResult result, int offset) {
        List<PackageSearchItem> items = result.getItems();
        List<GenericEdge<PackageSearchItem>> edges = buildEdges(items, offset);
        String startCursor = edges.isEmpty() ? null : edges.getFirst().getCursor();
        String endCursor = edges.isEmpty() ? null : edges.getLast().getCursor();
        PageInfo pageInfo = PageInfo.builder()
                .hasNextPage(result.isHasMore())
                .hasPreviousPage(offset > 0)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
        return PackageSearchConnection.builder()
                .edges(edges)
                .pageInfo(pageInfo)
                .filteredCount(result.getTotal())
                .build();
    }

    private static List<GenericEdge<PackageSearchItem>> buildEdges(List<PackageSearchItem> items, int offset) {
        return java.util.stream.IntStream.range(0, items.size())
                .mapToObj(i -> GenericEdge.<PackageSearchItem>builder()
                        .node(items.get(i))
                        .cursor(CursorCodec.encode(String.valueOf(offset + i + 1)))
                        .build())
                .toList();
    }

    private static int offsetFrom(String after) {
        String decoded = CursorCodec.decode(after);
        if (decoded == null) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(decoded));
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
}
