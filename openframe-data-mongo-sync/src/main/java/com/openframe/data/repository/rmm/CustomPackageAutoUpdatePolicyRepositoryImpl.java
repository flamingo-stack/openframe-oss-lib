package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;

@Repository
@RequiredArgsConstructor
public class CustomPackageAutoUpdatePolicyRepositoryImpl implements CustomPackageAutoUpdatePolicyRepository {

    private final MongoTemplate mongoTemplate;

    @Override
    public void enable(PackageAutoUpdatePolicy template, Collection<String> machineIds) {
        if (machineIds.isEmpty()) {
            return;
        }
        Update update = enableUpdate(template, Instant.now());
        BulkOperations bulk = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, PackageAutoUpdatePolicy.class);
        machineIds.stream().distinct().forEach(machineId -> bulk.upsert(key(template, machineId), update));
        bulk.execute();
    }

    @Override
    public long disableBySoftwareId(String tenantId, String softwareId, String actor) {
        Query enabled = Query.query(Criteria.where("tenantId").is(tenantId)
                .and("softwareId").is(softwareId)
                .and("enabled").is(true));
        Update disable = new Update()
                .set("enabled", false)
                .set("updatedBy", actor)
                .set("updatedAt", Instant.now());
        return mongoTemplate.updateMulti(enabled, disable, PackageAutoUpdatePolicy.class).getModifiedCount();
    }

    private static Query key(PackageAutoUpdatePolicy template, String machineId) {
        return Query.query(Criteria.where("tenantId").is(template.getTenantId())
                .and("machineId").is(machineId)
                .and("packageManager").is(template.getPackageManager())
                .and("packageName").is(template.getPackageName()));
    }

    private static Update enableUpdate(PackageAutoUpdatePolicy template, Instant now) {
        Update update = new Update()
                .set("enabled", true)
                .set("brewPackageType", template.getBrewPackageType())
                .set("settings", template.getSettings())
                .set("updatedBy", template.getUpdatedBy())
                .set("updatedAt", now)
                .setOnInsert("createdBy", template.getUpdatedBy())
                .setOnInsert("createdAt", now);
        // a run picked from the package search keeps the Software an earlier run linked
        if (template.getSoftwareId() != null) {
            update.set("softwareId", template.getSoftwareId());
        }
        return update;
    }
}
