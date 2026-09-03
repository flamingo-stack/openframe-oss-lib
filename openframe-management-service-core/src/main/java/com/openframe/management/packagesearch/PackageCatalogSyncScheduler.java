package com.openframe.management.packagesearch;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.package-search.sync.enabled", havingValue = "true")
public class PackageCatalogSyncScheduler {

    // holding the lock for (almost) the whole interval is what turns "every tenant's cron"
    // into one sync per environment: later firers find it held and skip the cycle
    private static final Duration LOCK_MARGIN = Duration.ofMinutes(1);

    private final BrewCatalogFetcher brewCatalogFetcher;
    private final WingetCatalogFetcher wingetCatalogFetcher;
    private final PackageCatalogWriter packageCatalogWriter;
    private final PackageCatalogSyncProperties syncProperties;
    private final LockingTaskExecutor packageCatalogSyncLockExecutor;

    @Scheduled(initialDelayString = "${openframe.package-search.sync.initial-delay:10000}",
            fixedDelayString = "${openframe.package-search.sync.brew-interval:900000}")
    public void syncBrewCatalog() {
        Duration interval = syncProperties.getBrewInterval();
        runLocked("package-catalog-brew-sync", interval, this::runBrewSync);
    }

    @Scheduled(initialDelayString = "${openframe.package-search.sync.initial-delay:10000}",
            fixedDelayString = "${openframe.package-search.sync.winget-interval:1800000}")
    public void syncWingetCatalog() {
        Duration interval = syncProperties.getWingetInterval();
        runLocked("package-catalog-winget-sync", interval, this::runWingetSync);
    }

    private void runLocked(String lockName, Duration interval, Runnable task) {
        Duration lockAtLeastFor = lockAtLeastFor(interval);
        LockConfiguration lockConfiguration = new LockConfiguration(Instant.now(), lockName, interval, lockAtLeastFor);
        packageCatalogSyncLockExecutor.executeWithLock(task, lockConfiguration);
    }

    private static Duration lockAtLeastFor(Duration interval) {
        return interval.compareTo(LOCK_MARGIN) > 0 ? interval.minus(LOCK_MARGIN) : Duration.ZERO;
    }

    private void runBrewSync() {
        try {
            List<PackageCatalogEntry> entries = brewCatalogFetcher.fetchAll();
            packageCatalogWriter.replaceManagerEntries(PackageManagerType.BREW, entries);
        } catch (Exception e) {
            log.error("Homebrew catalog sync failed, keeping the previous snapshot", e);
        }
    }

    private void runWingetSync() {
        try {
            List<PackageCatalogEntry> entries = wingetCatalogFetcher.fetchAll();
            packageCatalogWriter.replaceManagerEntries(PackageManagerType.WINGET, entries);
        } catch (Exception e) {
            log.error("winget catalog sync failed, keeping the previous snapshot", e);
        }
    }
}
