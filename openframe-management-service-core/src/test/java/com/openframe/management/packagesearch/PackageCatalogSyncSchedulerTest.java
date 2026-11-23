package com.openframe.management.packagesearch;

import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import net.javacrumbs.shedlock.core.DefaultLockingTaskExecutor;
import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import net.javacrumbs.shedlock.core.SimpleLock;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageCatalogSyncSchedulerTest {

    private static final String CHOCO_LOCK = "package-catalog-choco-sync";

    @Mock private BrewCatalogFetcher brewCatalogFetcher;
    @Mock private WingetCatalogFetcher wingetCatalogFetcher;
    @Mock private ChocoCatalogFetcher chocoCatalogFetcher;
    @Mock private PackageCatalogWriter packageCatalogWriter;
    @Mock private PackageCatalogSyncMetrics syncMetrics;
    @Spy private PackageCatalogSyncProperties syncProperties = new PackageCatalogSyncProperties();
    @Spy private PackageManagerProperties packageManagerProperties = new PackageManagerProperties();
    @Spy private LockingTaskExecutor packageCatalogSyncLockExecutor =
            new DefaultLockingTaskExecutor(configuration -> Optional.<SimpleLock>of(() -> { }));

    @Captor private ArgumentCaptor<LockConfiguration> lockCaptor;

    @InjectMocks private PackageCatalogSyncScheduler scheduler;

    @Test
    void syncChocoCatalog_chocoDisabled_noFetch() {
        // setup
        packageManagerProperties.setChocoEnabled(false);

        // execution
        scheduler.syncChocoCatalog();

        // verifications
        verifyNoInteractions(chocoCatalogFetcher, packageCatalogWriter, syncMetrics);
    }

    @Test
    void syncChocoCatalog_enabled_replacesChocoEntries() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        List<PackageCatalogEntry> entries = List.of(chocoEntry("7zip"), chocoEntry("GoogleChrome"));
        when(chocoCatalogFetcher.fetchAll()).thenReturn(entries);

        // execution
        scheduler.syncChocoCatalog();

        // verifications
        verify(packageCatalogWriter).replaceManagerEntries(PackageManagerType.CHOCO, entries);
    }

    @Test
    void syncChocoCatalog_enabled_successRecordedForChoco() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        when(chocoCatalogFetcher.fetchAll()).thenReturn(List.of(chocoEntry("7zip")));

        // execution
        scheduler.syncChocoCatalog();

        // verifications
        verify(syncMetrics).recordSuccess(PackageManagerType.CHOCO);
        verify(syncMetrics, never()).recordFailure(PackageManagerType.CHOCO);
    }

    @Test
    void syncChocoCatalog_fetchFails_failureRecordedAndPreviousSnapshotKept() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        when(chocoCatalogFetcher.fetchAll()).thenThrow(new IllegalStateException("feed is down"));

        // execution
        scheduler.syncChocoCatalog();

        // verifications
        verify(syncMetrics).recordFailure(PackageManagerType.CHOCO);
        verify(syncMetrics, never()).recordSuccess(PackageManagerType.CHOCO);
        verify(packageCatalogWriter, never()).replaceManagerEntries(eq(PackageManagerType.CHOCO), anyList());
    }

    @Test
    void syncChocoCatalog_fetchReturnsNoEntries_failureRecordedAndPreviousSnapshotKept() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        when(chocoCatalogFetcher.fetchAll()).thenReturn(List.of());

        // execution
        scheduler.syncChocoCatalog();

        // verifications
        verify(syncMetrics).recordFailure(PackageManagerType.CHOCO);
        verify(syncMetrics, never()).recordSuccess(PackageManagerType.CHOCO);
        verify(packageCatalogWriter, never()).replaceManagerEntries(eq(PackageManagerType.CHOCO), anyList());
    }

    @Test
    void syncBrewCatalog_enabled_replacesBrewEntries() {
        // setup
        List<PackageCatalogEntry> entries = List.of(entry(PackageManagerType.BREW, "wget"));
        when(brewCatalogFetcher.fetchAll()).thenReturn(entries);

        // execution
        scheduler.syncBrewCatalog();

        // verifications
        verify(packageCatalogWriter).replaceManagerEntries(PackageManagerType.BREW, entries);
        verify(syncMetrics).recordSuccess(PackageManagerType.BREW);
        verify(syncMetrics, never()).recordFailure(PackageManagerType.BREW);
    }

    @Test
    void syncBrewCatalog_fetchReturnsNoEntries_brewEntriesStillReplaced() {
        // setup
        List<PackageCatalogEntry> noEntries = List.of();
        when(brewCatalogFetcher.fetchAll()).thenReturn(noEntries);

        // execution
        scheduler.syncBrewCatalog();

        // verifications
        verify(packageCatalogWriter).replaceManagerEntries(PackageManagerType.BREW, noEntries);
        verify(syncMetrics).recordSuccess(PackageManagerType.BREW);
    }

    @Test
    void syncBrewCatalog_fetchFails_failureRecordedAndPreviousSnapshotKept() {
        // setup
        when(brewCatalogFetcher.fetchAll()).thenThrow(new IllegalStateException("formulae index is down"));

        // execution
        scheduler.syncBrewCatalog();

        // verifications
        verify(syncMetrics).recordFailure(PackageManagerType.BREW);
        verify(syncMetrics, never()).recordSuccess(PackageManagerType.BREW);
        verify(packageCatalogWriter, never()).replaceManagerEntries(eq(PackageManagerType.BREW), anyList());
    }

    @Test
    void syncWingetCatalog_enabled_replacesWingetEntries() {
        // setup
        List<PackageCatalogEntry> entries = List.of(entry(PackageManagerType.WINGET, "7zip.7zip"));
        when(wingetCatalogFetcher.fetchAll()).thenReturn(entries);

        // execution
        scheduler.syncWingetCatalog();

        // verifications
        verify(packageCatalogWriter).replaceManagerEntries(PackageManagerType.WINGET, entries);
        verify(syncMetrics).recordSuccess(PackageManagerType.WINGET);
        verify(syncMetrics, never()).recordFailure(PackageManagerType.WINGET);
    }

    @Test
    void syncWingetCatalog_fetchReturnsNoEntries_wingetEntriesStillReplaced() {
        // setup
        List<PackageCatalogEntry> noEntries = List.of();
        when(wingetCatalogFetcher.fetchAll()).thenReturn(noEntries);

        // execution
        scheduler.syncWingetCatalog();

        // verifications
        verify(packageCatalogWriter).replaceManagerEntries(PackageManagerType.WINGET, noEntries);
        verify(syncMetrics).recordSuccess(PackageManagerType.WINGET);
    }

    @Test
    void syncWingetCatalog_fetchFails_failureRecordedAndPreviousSnapshotKept() {
        // setup
        when(wingetCatalogFetcher.fetchAll()).thenThrow(new IllegalStateException("source index is down"));

        // execution
        scheduler.syncWingetCatalog();

        // verifications
        verify(syncMetrics).recordFailure(PackageManagerType.WINGET);
        verify(syncMetrics, never()).recordSuccess(PackageManagerType.WINGET);
        verify(packageCatalogWriter, never()).replaceManagerEntries(eq(PackageManagerType.WINGET), anyList());
    }

    @Test
    void syncChocoCatalog_enabled_lockedUnderTheChocoSyncNameForTheChocoInterval() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        syncProperties.setChocoInterval(Duration.ofMinutes(20));
        when(chocoCatalogFetcher.fetchAll()).thenReturn(List.of(chocoEntry("7zip")));

        // execution
        scheduler.syncChocoCatalog();

        // verifications
        verify(packageCatalogSyncLockExecutor).executeWithLock(any(Runnable.class), lockCaptor.capture());
        assertThat(lockCaptor.getValue())
                .returns(CHOCO_LOCK, LockConfiguration::getName)
                .returns(Duration.ofMinutes(20), LockConfiguration::getLockAtMostFor)
                .returns(Duration.ofMinutes(19), LockConfiguration::getLockAtLeastFor);
    }

    private static PackageCatalogEntry chocoEntry(String packageId) {
        return entry(PackageManagerType.CHOCO, packageId);
    }

    private static PackageCatalogEntry entry(PackageManagerType manager, String packageId) {
        return PackageCatalogEntry.builder()
                .manager(manager)
                .packageId(packageId)
                .name(packageId)
                .version("1.0.0")
                .build();
    }
}
