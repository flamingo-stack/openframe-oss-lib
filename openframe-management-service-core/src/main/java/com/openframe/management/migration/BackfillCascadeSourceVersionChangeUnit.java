package com.openframe.management.migration;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;

@Slf4j
@ChangeUnit(id = "backfill-cascade-source-version", order = "016", author = "openframe")
public class BackfillCascadeSourceVersionChangeUnit {

    private static final String VERSION_FIELD = "version";
    private static final String TENANT_ID_FIELD = "tenantId";
    private static final List<String> COLLECTIONS = List.of("users", "organizations", "machines", "tickets");

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        COLLECTIONS.forEach(collection -> backfill(mongoTemplate, collection, tenantId));
    }

    @RollbackExecution
    public void rollback() {
    }

    private void backfill(MongoTemplate mongoTemplate, String collection, String tenantId) {
        Query query = new Query(Criteria.where(TENANT_ID_FIELD).is(tenantId)
                .and(VERSION_FIELD).exists(false));
        Update update = new Update().set(VERSION_FIELD, 0L);
        UpdateResult result = mongoTemplate.updateMulti(query, update, collection);
        long modifiedCount = result.getModifiedCount();
        log.info("Backfilled {} on {} document(s) in collection {}", VERSION_FIELD, modifiedCount, collection);
    }
}
