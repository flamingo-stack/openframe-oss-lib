package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class CustomDeviceOsPendingUpdateRepositoryImpl implements CustomDeviceOsPendingUpdateRepository {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_IDENTIFIER = "identifier";
    private static final String FIELD_PLATFORM = "platform";
    private static final String FIELD_DISCOVERED_AT = "discoveredAt";
    private static final String FIELD_DOWNLOADED = "downloaded";
    private static final String FIELD_MACOS_PRESENCE = "macosPresence";

    private final MongoTemplate mongoTemplate;

    @Override
    public void upsertKeepingDiscoveredAt(List<DeviceOsPendingUpdate> pendingUpdates) {
        if (pendingUpdates.isEmpty()) {
            return;
        }
        BulkOperations bulkOperations =
                mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, DeviceOsPendingUpdate.class);
        pendingUpdates.forEach(pendingUpdate ->
                bulkOperations.upsert(samePendingUpdate(pendingUpdate), keepingDiscoveredAt(pendingUpdate)));
        bulkOperations.execute();
    }

    private static Query samePendingUpdate(DeviceOsPendingUpdate pendingUpdate) {
        Criteria samePendingUpdate = Criteria.where(FIELD_TENANT_ID).is(pendingUpdate.getTenantId())
                .and(FIELD_MACHINE_ID).is(pendingUpdate.getMachineId())
                .and(FIELD_IDENTIFIER).is(pendingUpdate.getIdentifier());
        return Query.query(samePendingUpdate);
    }

    private static Update keepingDiscoveredAt(DeviceOsPendingUpdate pendingUpdate) {
        Update update = new Update()
                .setOnInsert(FIELD_DISCOVERED_AT, pendingUpdate.getDiscoveredAt())
                .set(FIELD_PLATFORM, pendingUpdate.getPlatform());
        setOrUnset(update, FIELD_DOWNLOADED, pendingUpdate.getDownloaded());
        setOrUnset(update, FIELD_MACOS_PRESENCE, pendingUpdate.getMacosPresence());
        return update;
    }

    // An Update never writes a null, and what an earlier report stored must not survive.
    private static void setOrUnset(Update update, String field, Object value) {
        if (value != null) {
            update.set(field, value);
            return;
        }
        update.unset(field);
    }
}
