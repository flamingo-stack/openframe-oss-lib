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

@Slf4j
@ChangeUnit(id = "backfill-document-version", order = "001", author = "openframe")
public class BackfillDocumentVersionChangeUnit {

    private static final String DOCUMENT_VERSION_FIELD = "documentVersion";
    private static final String INTEGRATED_TOOL_AGENTS_COLLECTION = "integrated_tool_agents";
    private static final String OPENFRAME_CLIENT_CONFIGURATION_COLLECTION = "openframe_client_configuration";
    private static final String RELEASE_VERSIONS_COLLECTION = "release_versions";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        backfill(mongoTemplate, INTEGRATED_TOOL_AGENTS_COLLECTION, tenantId);
        backfill(mongoTemplate, OPENFRAME_CLIENT_CONFIGURATION_COLLECTION, tenantId);
        backfill(mongoTemplate, RELEASE_VERSIONS_COLLECTION, tenantId);
    }

    @RollbackExecution
    public void rollback() {
    }

    private void backfill(MongoTemplate mongoTemplate, String collection, String tenantId) {
        Query query = new Query(Criteria.where("tenantId").is(tenantId)
                .and(DOCUMENT_VERSION_FIELD).exists(false));
        Update update = new Update().set(DOCUMENT_VERSION_FIELD, 0L);
        UpdateResult result = mongoTemplate.updateMulti(query, update, collection);
        long modifiedCount = result.getModifiedCount();
        log.info("Backfilled {} on {} document(s) in collection {}",
                DOCUMENT_VERSION_FIELD, modifiedCount, collection);
    }
}
