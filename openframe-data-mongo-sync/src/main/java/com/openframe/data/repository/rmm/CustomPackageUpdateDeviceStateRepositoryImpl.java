package com.openframe.data.repository.rmm;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
@RequiredArgsConstructor
public class CustomPackageUpdateDeviceStateRepositoryImpl implements CustomPackageUpdateDeviceStateRepository {

    private final MongoTemplate mongoTemplate;

    @Override
    public boolean finishInProgress(String tenantId, String requestId, String machineId, SoftwareActionStatus status,
                                    String failedMessage) {
        Criteria inProgress = Criteria.where("tenantId").is(tenantId)
                .and("requestId").is(requestId)
                .and("machineId").is(machineId)
                .and("status").is(SoftwareActionStatus.IN_PROGRESS);
        Query query = Query.query(inProgress);
        Update update = new Update()
                .set("status", status)
                .set("failedMessage", failedMessage)
                .set("updatedAt", Instant.now());
        UpdateResult result = mongoTemplate.updateFirst(query, update, PackageUpdateDeviceState.class);
        return result.getModifiedCount() > 0;
    }
}
