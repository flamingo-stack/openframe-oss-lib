package com.openframe.management.packagesearch;

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

import java.time.Duration;
import java.time.Instant;
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

    // the collection lives in the SHARED database and every tenant's management syncs it; the prune
    // grace absorbs overlapping syncs stamping older timestamps over each other — deleting only
    // entries no sync has touched for hours can never race a concurrent writer
    private static final Duration PRUNE_GRACE = Duration.ofHours(6);

    // upsert everything with a fresh timestamp, then prune what no snapshot contains anymore —
    // the collection is never empty mid-sync
    public void replaceManagerEntries(PackageManagerType manager, List<PackageCatalogEntry> entries) {
        String managerName = manager.name();
        Instant syncStart = Instant.now();
        BulkOperations bulk = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, PackageCatalogEntry.class);
        for (PackageCatalogEntry entry : entries) {
            entry.setUpdatedAt(syncStart);
            Query byId = new Query(Criteria.where("_id").is(entry.getId()));
            bulk.replaceOne(byId, entry, FindAndReplaceOptions.options().upsert());
        }
        bulk.execute();

        Instant pruneBefore = syncStart.minus(PRUNE_GRACE);
        Query stale = new Query(Criteria.where("manager").is(managerName).and("updatedAt").lt(pruneBefore));
        long pruned = mongoTemplate.remove(stale, PackageCatalogEntry.class).getDeletedCount();
        log.info("Synced {} catalog: {} entries upserted, {} stale pruned", manager, entries.size(), pruned);
    }
}
