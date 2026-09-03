package com.openframe.management.packagesearch;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.FindAndReplaceOptions;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Locale;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class PackageCatalogWriter {

    // PackageCatalogEntry is deliberately not TenantScoped (public data, one copy per tenant DB);
    // the tenant-aware template is the house-mandated injection point either way
    private final TenantAwareMongoTemplate mongoTemplate;

    @PostConstruct
    public void ensureIndexes() {
        Index byManager = new Index().on("manager", Sort.Direction.ASC);
        mongoTemplate.indexOps(PackageCatalogEntry.class).ensureIndex(byManager);
    }

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
        BulkOperations bulk = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, PackageCatalogEntry.class);
        for (PackageCatalogEntry entry : entries) {
            entry.setId(entryIdOf(entry));
            entry.setUpdatedAt(syncStart);
            Query byId = new Query(Criteria.where("_id").is(entry.getId()));
            bulk.replaceOne(byId, entry, FindAndReplaceOptions.options().upsert());
        }
        bulk.execute();

        Query stale = new Query(Criteria.where("manager").is(manager).and("updatedAt").lt(syncStart));
        long pruned = mongoTemplate.remove(stale, PackageCatalogEntry.class).getDeletedCount();
        log.info("Synced {} catalog: {} entries upserted, {} stale pruned", manager, entries.size(), pruned);
    }
}
