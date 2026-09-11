package com.openframe.management.migration;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptType;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;

@Slf4j
@ChangeUnit(id = "migrate-script-system-flag-to-type", order = "012", author = "openframe")
public class MigrateScriptSystemFlagToTypeChangeUnit {

    private static final String COLLECTION = "scripts";
    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String SYSTEM_FIELD = "system";
    private static final String TYPE_FIELD = "type";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();

        UpdateResult system = mongoTemplate.getCollection(COLLECTION).updateMany(
                new Document(TENANT_ID_FIELD, tenantId).append(SYSTEM_FIELD, true),
                new Document("$set", new Document(TYPE_FIELD, ScriptType.SYSTEM.name()))
                        .append("$unset", new Document(SYSTEM_FIELD, "")));

        UpdateResult user = mongoTemplate.getCollection(COLLECTION).updateMany(
                new Document(TENANT_ID_FIELD, tenantId).append(TYPE_FIELD, new Document("$exists", false)),
                new Document("$set", new Document(TYPE_FIELD, ScriptType.USER.name()))
                        .append("$unset", new Document(SYSTEM_FIELD, "")));

        log.info("Migrated script.system → script.type for tenantId={}: SYSTEM={}, USER={}",
                tenantId, system.getModifiedCount(), user.getModifiedCount());
    }

    @RollbackExecution
    public void rollback() {
        // forward-only: the boolean is intentionally not restored
    }
}
