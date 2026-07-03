package com.openframe.data.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.data.mongodb.core.query.Criteria;

@Slf4j
@Configuration
public class MongoIndexConfig {

    /**
     * Partial-unique name index on {@code scripts}. Explicitly named so it
     * survives redeploys and can be dropped/recreated cleanly.
     */
    private static final String SCRIPTS_NAME_UNIQUE_INDEX = "scripts_tenant_name_notDeleted_unique";

    @Autowired
    private MongoTemplate mongoTemplate;

    @PostConstruct
    public void initIndexes() {
        mongoTemplate.indexOps("application_events")
            .ensureIndex(new Index().on("userId", Sort.Direction.ASC)
                                  .on("timestamp", Sort.Direction.DESC));

        mongoTemplate.indexOps("application_events")
            .ensureIndex(new Index().on("type", Sort.Direction.ASC)
                                  .on("metadata.tags", Sort.Direction.ASC));

        // Drop stale 'name' unique index from tags collection (legacy schema)
        dropStaleIndex("tags", "name");

        // Drop legacy org-scoped indexes — tags are now tenant-wide and uniqueness is
        // enforced by {key, entityType} via 'key_entity_idx'.
        dropStaleIndex("tags", "key_org_idx");
        dropStaleIndex("tags", "key_org_entity_idx");

        // Scripts: name uniqueness IGNORES soft-deleted rows so a user can
        // reuse the name of a script they previously deleted. The legacy
        // {tenantId, name} unique index (auto-named "tenantId_1_name_1") did
        // not filter status — drop it and recreate as a PARTIAL unique index
        // over {status: {$ne: 'DELETED'}}.
        dropStaleIndex("scripts", "tenantId_1_name_1");
        mongoTemplate.indexOps("scripts").ensureIndex(
                new Index().on("tenantId", Sort.Direction.ASC)
                        .on("name", Sort.Direction.ASC)
                        .unique()
                        .named(SCRIPTS_NAME_UNIQUE_INDEX)
                        .partial(PartialIndexFilter.of(Criteria.where("status").ne("DELETED"))));
    }

    private void dropStaleIndex(String collection, String indexName) {
        try {
            mongoTemplate.indexOps(collection).dropIndex(indexName);
            log.info("Dropped stale index '{}' from collection '{}'", indexName, collection);
        } catch (Exception e) {
            // Index doesn't exist — nothing to do
            log.debug("Index '{}' not found on collection '{}', skipping", indexName, collection);
        }
    }
}