package com.openframe.management.migration;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;

// A non-PENDING machine connected no later than its last heartbeat, so lastSeen backfills the new
// Machine.firstConnectedAt; PENDING machines never connected and stay null. Rollback is empty on purpose:
// a stamp derived from lastSeen is never wrong, only absent.
@Slf4j
@ChangeUnit(id = "backfill-machine-first-connected-at", order = "016", author = "openframe")
public class BackfillMachineFirstConnectedAtChangeUnit {

    private static final String COLLECTION = "machines";
    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String STATUS_FIELD = "status";
    private static final String FIRST_CONNECTED_AT_FIELD = "firstConnectedAt";
    private static final String LAST_SEEN_FIELD = "lastSeen";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        Document filter = new Document(TENANT_ID_FIELD, tenantId)
                .append(STATUS_FIELD, new Document("$ne", DeviceStatus.PENDING.name()))
                .append(FIRST_CONNECTED_AT_FIELD, new Document("$exists", false))
                .append(LAST_SEEN_FIELD, new Document("$exists", true));
        List<Document> copyLastSeen = List.of(
                new Document("$set", new Document(FIRST_CONNECTED_AT_FIELD, "$" + LAST_SEEN_FIELD)));

        UpdateResult result = mongoTemplate.getCollection(COLLECTION).updateMany(filter, copyLastSeen);

        log.info("Backfilled firstConnectedAt from lastSeen on {} machine(s), tenantId={}",
                result.getModifiedCount(), tenantId);
    }

    @RollbackExecution
    public void rollback() {
    }
}
