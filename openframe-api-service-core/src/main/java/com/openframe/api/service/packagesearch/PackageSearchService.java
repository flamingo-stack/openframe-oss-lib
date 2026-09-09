package com.openframe.api.service.packagesearch;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.api.dto.packagesearch.PackageSearchInput;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
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

    public PackageSearchService(List<PackageManagerClient> clientList) {
        this.clients = clientList.stream()
                .collect(toUnmodifiableMap(PackageManagerClient::getPackageManagerType, identity()));
    }

    public PackageSearchResult search(PackageSearchInput input) {
        String rawQuery = input.getQuery();
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.length() < MIN_QUERY_LENGTH) {
            throw new IllegalArgumentException("query must be at least " + MIN_QUERY_LENGTH + " characters long");
        }
        Integer requestedLimit = input.getLimit();
        Integer requestedOffset = input.getOffset();
        int limit = requestedLimit == null ? DEFAULT_LIMIT : Math.clamp(requestedLimit, 1, MAX_LIMIT);
        int offset = requestedOffset == null ? 0 : Math.max(requestedOffset, 0);
        PackageManagerType packageManager = input.getPackageManager();
        PackageManagerClient client = clientFor(packageManager);
        return client.search(query, limit, offset);
    }

    public PackageDetails findPackage(PackageManagerType packageManager, String packageId, BrewPackageType packageType) {
        if (!hasText(packageId)) {
            throw new IllegalArgumentException("packageId must not be blank");
        }
        String id = packageId.trim();
        PackageManagerClient client = clientFor(packageManager);
        return client.findPackage(id, packageType);
    }

    private PackageManagerClient clientFor(PackageManagerType packageManager) {
        PackageManagerClient client = clients.get(packageManager);
        if (client == null) {
            throw new IllegalStateException("no package manager client registered for " + packageManager);
        }
        return client;
    }
}
