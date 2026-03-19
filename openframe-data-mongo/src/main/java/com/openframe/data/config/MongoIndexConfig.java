package com.openframe.data.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;

@Slf4j
@Configuration
public class MongoIndexConfig {

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