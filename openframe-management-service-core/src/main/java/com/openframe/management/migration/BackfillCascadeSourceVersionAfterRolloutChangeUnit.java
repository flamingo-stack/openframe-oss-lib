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

// Second run of backfill-cascade-source-version: while the version field rolled out, pods still on the old image inserted
// documents without it or saved over it after 016 ran. Release only once every service writes version (oss-lib 7.0.15+).
@Slf4j
@ChangeUnit(id = "backfill-cascade-source-version-after-rollout", order = "019", author = "openframe")
public class BackfillCascadeSourceVersionAfterRolloutChangeUnit {

    private static final String VERSION_FIELD = "version";
    private static final String TENANT_ID_FIELD = "tenantId";
    // The two directory configs exist only in SaaS; in OSS the update matches nothing.
    private static final List<String> COLLECTIONS = List.of("users", "organizations", "machines", "tickets",
            "microsoft365_configs", "google_workspace_configs");

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        COLLECTIONS.forEach(collection -> backfill(mongoTemplate, collection, tenantId));
    }

    @RollbackExecution
    public void rollback() {
    }

    // is(null) matches a missing field and an explicit null: @Version treats both as a new document.
    private void backfill(MongoTemplate mongoTemplate, String collection, String tenantId) {
        Query query = new Query(Criteria.where(TENANT_ID_FIELD).is(tenantId)
                .and(VERSION_FIELD).is(null));
        Update update = new Update().set(VERSION_FIELD, 0L);
        UpdateResult result = mongoTemplate.updateMulti(query, update, collection);
        long modifiedCount = result.getModifiedCount();
        log.info("Backfilled {} on {} document(s) in collection {} after the rollout", VERSION_FIELD, modifiedCount, collection);
    }
}
