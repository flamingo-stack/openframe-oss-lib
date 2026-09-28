package com.openframe.data.repository.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.FindAndReplaceOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Collation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

@RequiredArgsConstructor
public class PackageCatalogRepositoryImpl implements PackageCatalogRepositoryCustom {

    // same collation as the listing indexes on PackageCatalogEntry, or Mongo skips them
    private static final Collation CASE_INSENSITIVE = Collation.of("en").strength(2);

    private final MongoTemplate mongoTemplate;

    @Override
    public void upsertAll(List<PackageCatalogEntry> entries) {
        BulkOperations bulk = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, PackageCatalogEntry.class);
        for (PackageCatalogEntry entry : entries) {
            Query byId = new Query(Criteria.where("_id").is(entry.getId()));
            bulk.replaceOne(byId, entry, FindAndReplaceOptions.options().upsert());
        }
        bulk.execute();
    }

    @Override
    public List<PackageCatalogEntry> listByManager(PackageManagerType manager, Sort sort, int offset, int limit) {
        Query query = new Query(Criteria.where("manager").is(manager))
                .with(sort)
                .collation(CASE_INSENSITIVE)
                .skip(offset)
                .limit(limit);
        return mongoTemplate.find(query, PackageCatalogEntry.class);
    }
}
