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

    // the lock is held for interval-minus-margin even after the sync finishes, so every other
    // tenant firing within the interval skips its cycle; the margin guarantees the lock is
    // released before the next cycle is due, otherwise phase drift between pods would skip cycles
    private static final Duration LOCK_MARGIN = Duration.ofMinutes(1);

    private final BrewCatalogFetcher brewCatalogFetcher;
    private final WingetCatalogFetcher wingetCatalogFetcher;
    private final PackageCatalogWriter packageCatalogWriter;
    private final PackageCatalogSyncProperties syncProperties;
    private final LockingTaskExecutor packageCatalogSyncLockExecutor;

    @Scheduled(initialDelayString = "#{@packageCatalogSyncProperties.initialDelay.toMillis()}",
            fixedDelayString = "#{@packageCatalogSyncProperties.brewInterval.toMillis()}")
    public void syncBrewCatalog() {
        Duration interval = syncProperties.getBrewInterval();
        runLocked("package-catalog-brew-sync", interval, this::runBrewSync);
    }

    @Scheduled(initialDelayString = "#{@packageCatalogSyncProperties.initialDelay.toMillis()}",
            fixedDelayString = "#{@packageCatalogSyncProperties.wingetInterval.toMillis()}")
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
