package com.openframe.management.migration;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;

import java.time.Duration;

@Slf4j
@ChangeUnit(id = "create-software-bundle-ttl-index", order = "014", author = "openframe")
public class CreateSoftwareBundleTtlIndexChangeUnit {

    private static final String COLLECTION = "software_bundles";
    private static final String EXPIRE_AT_FIELD = "expireAt";

    @Execution
    public void execution(MongoTemplate mongoTemplate) {
        Index ttlIndex = new Index()
                .on(EXPIRE_AT_FIELD, Sort.Direction.ASC)
                .expire(Duration.ZERO)
                .named("software_bundles_expireAt_ttl");
        String name = mongoTemplate.indexOps(COLLECTION).ensureIndex(ttlIndex);
        log.info("Ensured TTL index '{}' on {}.{}", name, COLLECTION, EXPIRE_AT_FIELD);
    }

    @RollbackExecution
    public void rollback(MongoTemplate mongoTemplate) {
        mongoTemplate.indexOps(COLLECTION).dropIndex("software_bundles_expireAt_ttl");
    }
}
