package com.openframe.management.packagesearch;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.package-search.sync.enabled", havingValue = "true")
public class PackageCatalogSyncScheduler {

    private final BrewCatalogFetcher brewCatalogFetcher;
    private final WingetCatalogFetcher wingetCatalogFetcher;
    private final PackageCatalogWriter packageCatalogWriter;

    @Scheduled(initialDelayString = "${openframe.package-search.sync.initial-delay:10000}",
            fixedDelayString = "${openframe.package-search.sync.brew-interval:900000}")
    public void syncBrewCatalog() {
        try {
            List<PackageCatalogEntry> entries = brewCatalogFetcher.fetchAll();
            packageCatalogWriter.replaceManagerEntries(PackageManagerType.BREW, entries);
        } catch (Exception e) {
            log.error("Homebrew catalog sync failed, keeping the previous snapshot", e);
        }
    }

    @Scheduled(initialDelayString = "${openframe.package-search.sync.initial-delay:10000}",
            fixedDelayString = "${openframe.package-search.sync.winget-interval:1800000}")
    public void syncWingetCatalog() {
        try {
            List<PackageCatalogEntry> entries = wingetCatalogFetcher.fetchAll();
            packageCatalogWriter.replaceManagerEntries(PackageManagerType.WINGET, entries);
        } catch (Exception e) {
            log.error("winget catalog sync failed, keeping the previous snapshot", e);
        }
    }
}
