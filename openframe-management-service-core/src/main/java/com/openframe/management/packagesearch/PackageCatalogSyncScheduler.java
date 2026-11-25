package com.openframe.management.packagesearch;

import com.openframe.data.config.PackageManagerProperties;
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
import java.util.function.Supplier;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.package-search.sync.enabled", havingValue = "true")
public class PackageCatalogSyncScheduler {

    private static final Duration LOCK_MARGIN = Duration.ofMinutes(1);

    private final BrewCatalogFetcher brewCatalogFetcher;
    private final WingetCatalogFetcher wingetCatalogFetcher;
    private final PackageCatalogWriter packageCatalogWriter;
    private final PackageCatalogSyncProperties syncProperties;
    private final LockingTaskExecutor packageCatalogSyncLockExecutor;
    private final PackageCatalogSyncMetrics syncMetrics;
    private final ChocoCatalogFetcher chocoCatalogFetcher;
    private final PackageManagerProperties packageManagerProperties;

    @Scheduled(initialDelayString = "#{@packageCatalogSyncProperties.initialDelay.toMillis()}",
            fixedDelayString = "#{@packageCatalogSyncProperties.brewInterval.toMillis()}")
    public void syncBrewCatalog() {
        Duration interval = syncProperties.getBrewInterval();
        runLocked("package-catalog-brew-sync", interval,
                () -> runSync(PackageManagerType.BREW, brewCatalogFetcher::fetchAll));
    }

    @Scheduled(initialDelayString = "#{@packageCatalogSyncProperties.initialDelay.toMillis()}",
            fixedDelayString = "#{@packageCatalogSyncProperties.wingetInterval.toMillis()}")
    public void syncWingetCatalog() {
        Duration interval = syncProperties.getWingetInterval();
        runLocked("package-catalog-winget-sync", interval,
                () -> runSync(PackageManagerType.WINGET, wingetCatalogFetcher::fetchAll));
    }

    @Scheduled(initialDelayString = "#{@packageCatalogSyncProperties.initialDelay.toMillis()}",
            fixedDelayString = "#{@packageCatalogSyncProperties.chocoInterval.toMillis()}")
    public void syncChocoCatalog() {
        if (packageManagerProperties.isDisabled(PackageManagerType.CHOCO)) {
            return;
        }
        Duration interval = syncProperties.getChocoInterval();
        runLocked("package-catalog-choco-sync", interval,
                () -> runSync(PackageManagerType.CHOCO, chocoCatalogFetcher::fetchAll));
    }

    private void runLocked(String lockName, Duration interval, Runnable task) {
        Duration lockAtLeastFor = lockAtLeastFor(interval);
        LockConfiguration lockConfiguration = new LockConfiguration(Instant.now(), lockName, interval, lockAtLeastFor);
        packageCatalogSyncLockExecutor.executeWithLock(task, lockConfiguration);
    }

    private static Duration lockAtLeastFor(Duration interval) {
        return interval.compareTo(LOCK_MARGIN) > 0 ? interval.minus(LOCK_MARGIN) : Duration.ZERO;
    }

    private void runSync(PackageManagerType manager, Supplier<List<PackageCatalogEntry>> fetcher) {
        try {
            List<PackageCatalogEntry> entries = fetcher.get();
            if (isEmptyChocoCatalog(manager, entries)) {
                log.warn("{} catalog fetch returned no entries, keeping the previous snapshot", manager);
                syncMetrics.recordFailure(manager);
                return;
            }
            packageCatalogWriter.replaceManagerEntries(manager, entries);
            syncMetrics.recordSuccess(manager);
        } catch (Exception e) {
            log.error("{} catalog sync failed, keeping the previous snapshot", manager, e);
            syncMetrics.recordFailure(manager);
        }
    }

    private static boolean isEmptyChocoCatalog(PackageManagerType manager, List<PackageCatalogEntry> entries) {
        return manager == PackageManagerType.CHOCO && entries.isEmpty();
    }
}
