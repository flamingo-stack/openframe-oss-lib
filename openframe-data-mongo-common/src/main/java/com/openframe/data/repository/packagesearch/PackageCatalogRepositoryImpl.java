package com.openframe.data.repository.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.FindAndReplaceOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

@RequiredArgsConstructor
public class PackageCatalogRepositoryImpl implements PackageCatalogRepositoryCustom {

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
}
