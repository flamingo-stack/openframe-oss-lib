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
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.CHOCO)
                .packageId(packageId)
                .name(packageId)
                .version("1.0.0")
                .build();
    }
}
