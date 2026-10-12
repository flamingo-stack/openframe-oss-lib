package com.openframe.management.migration;

import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;

// rollback is empty: restoring "MACOS" would reintroduce a value the enum has since dropped
@Slf4j
@ChangeUnit(id = "rename-os-type-macos-to-mac-os-in-scripts", order = "009", author = "openframe")
public class RenameOsTypeMacosToMacOsInScriptsChangeUnit {

    private static final String COLLECTION = "scripts";
    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String SUPPORTED_PLATFORMS_FIELD = "supportedPlatforms";
    private static final String LEGACY_VALUE = "MACOS";
    private static final String CANONICAL_VALUE = "MAC_OS";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        UpdateResult result = mongoTemplate.getCollection(COLLECTION).updateMany(
                new Document(TENANT_ID_FIELD, tenantId).append(SUPPORTED_PLATFORMS_FIELD, LEGACY_VALUE),
                new Document("$set", new Document(SUPPORTED_PLATFORMS_FIELD + ".$[e]", CANONICAL_VALUE)),
                new UpdateOptions().arrayFilters(List.of(new Document("e", LEGACY_VALUE)))
        );
        log.info("Renamed {} → {} in supportedPlatforms of {} script(s), tenantId={}",
                LEGACY_VALUE, CANONICAL_VALUE, result.getModifiedCount(), tenantId);
    }

    @RollbackExecution
    public void rollback() {
    }
}

