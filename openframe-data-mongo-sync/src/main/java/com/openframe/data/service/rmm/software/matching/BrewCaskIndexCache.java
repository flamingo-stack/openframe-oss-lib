package com.openframe.data.service.rmm.software.matching;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

@Component
@RequiredArgsConstructor
public class BrewCaskIndexCache {

    private static final Duration TTL = Duration.ofMinutes(5);

    private final PackageCatalogRepository packageCatalogRepository;
    private final TenantIdProvider tenantIdProvider;

    private final Cache<String, BrewCaskIndex> byTenant = Caffeine.newBuilder()
            .expireAfterWrite(TTL)
            .build();

    public BrewCaskIndex getBrewCaskIndex() {
        String tenantId = tenantIdProvider.getTenantId();
        return byTenant.get(tenantId, key -> load());
    }

    private BrewCaskIndex load() {
        List<PackageCatalogEntry> casks = packageCatalogRepository
                .findByManagerAndBrewType(PackageManagerType.BREW, BrewPackageType.CASK);
        return new BrewCaskIndex(casks);
    }
}
