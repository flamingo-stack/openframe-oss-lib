package com.openframe.management.migration;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;

// Documents still holding a retired step name fail Set<enum> deserialization; this ships with the enum change.
@Slf4j
@ChangeUnit(id = "prune-retired-onboarding-steps", order = "011", author = "openframe")
public class PruneRetiredOnboardingStepsChangeUnit {

    private static final String TENANT_COLLECTION = "tenant_onboarding_progress";
    private static final String USER_COLLECTION = "user_onboarding_progress";
    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String COMPLETED_STEPS_FIELD = "completedSteps";

    private static final List<String> RETIRED_TENANT_STEPS = List.of("COMPANY_TEAM");
    private static final List<String> RETIRED_USER_STEPS = List.of("CUSTOMERS_SETUP", "DEVICE_MANAGEMENT");

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        prune(mongoTemplate, TENANT_COLLECTION, RETIRED_TENANT_STEPS, tenantId);
        prune(mongoTemplate, USER_COLLECTION, RETIRED_USER_STEPS, tenantId);
    }

    @RollbackExecution
    public void rollback() {
    }

    private void prune(MongoTemplate mongoTemplate, String collection, List<String> retiredSteps, String tenantId) {
        UpdateResult result = mongoTemplate.getCollection(collection).updateMany(
                new Document(TENANT_ID_FIELD, tenantId)
                        .append(COMPLETED_STEPS_FIELD, new Document("$in", retiredSteps)),
                new Document("$pull", new Document(COMPLETED_STEPS_FIELD, new Document("$in", retiredSteps)))
        );
        log.info("Pruned retired onboarding step(s) {} from {} document(s) in {}, tenantId={}",
                retiredSteps, result.getModifiedCount(), collection, tenantId);
    }
}
