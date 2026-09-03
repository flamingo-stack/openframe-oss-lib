package com.openframe.management.packagesearch;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Locale;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class PackageCatalogWriter {

    private final PackageCatalogRepository packageCatalogRepository;

    // the composite key format is owned here, by the only place that writes it
    private static String entryIdOf(PackageCatalogEntry entry) {
        String lowerId = entry.getPackageId().toLowerCase(Locale.ROOT);
        BrewPackageType brewType = entry.getBrewType();
        return brewType == null
                ? entry.getManager() + ":" + lowerId
                : entry.getManager() + ":" + brewType + ":" + lowerId;
    }

    // upsert everything with a fresh timestamp, then prune what this snapshot no longer contains —
    // the collection is never empty mid-sync; the scheduler's environment-wide ShedLock guarantees
    // a single writer, so everything stamped before this sync is exactly the departed entries
    public void replaceManagerEntries(PackageManagerType manager, List<PackageCatalogEntry> entries) {
        Instant syncStart = Instant.now();
        for (PackageCatalogEntry entry : entries) {
            entry.setId(entryIdOf(entry));
            entry.setUpdatedAt(syncStart);
        }
        packageCatalogRepository.upsertAll(entries);
        long pruned = packageCatalogRepository.deleteByManagerAndUpdatedAtBefore(manager, syncStart);
        log.info("Synced {} catalog: {} entries upserted, {} stale pruned", manager, entries.size(), pruned);
    }
}
