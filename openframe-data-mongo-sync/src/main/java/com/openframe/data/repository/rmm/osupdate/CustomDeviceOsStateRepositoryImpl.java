package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndReplaceOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class CustomDeviceOsStateRepositoryImpl implements CustomDeviceOsStateRepository {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_RECEIVED_AT = "receivedAt";

    private final MongoTemplate mongoTemplate;

    // false = a newer report holds the document. The filter is the ordering guard: when it misses a stored document
    // the upsert tries an insert, which the unique {tenantId, machineId} index refuses.
    @Override
    public boolean replaceUnlessNewerStored(DeviceOsState deviceOsState) {
        Query storedNotNewer = storedNotNewer(deviceOsState);
        try {
            FindAndReplaceOptions replaceOrInsert = FindAndReplaceOptions.options().upsert().returnNew();
            return replace(storedNotNewer, deviceOsState, replaceOrInsert);
        } catch (DuplicateKeyException documentExists) {
            // a newer report holds the document, or another pod inserted it a moment ago
            FindAndReplaceOptions replaceOnly = FindAndReplaceOptions.options().returnNew();
            return replace(storedNotNewer, deviceOsState, replaceOnly);
        }
    }

    private boolean replace(Query storedNotNewer, DeviceOsState deviceOsState, FindAndReplaceOptions options) {
        DeviceOsState replaced = mongoTemplate.findAndReplace(storedNotNewer, deviceOsState, options);
        return replaced != null;
    }

    private static Query storedNotNewer(DeviceOsState deviceOsState) {
        Criteria neverReceived = Criteria.where(FIELD_RECEIVED_AT).isNull();
        Criteria receivedEarlier = Criteria.where(FIELD_RECEIVED_AT).lte(deviceOsState.getReceivedAt());
        Criteria ofMachine = Criteria.where(FIELD_TENANT_ID).is(deviceOsState.getTenantId())
                .and(FIELD_MACHINE_ID).is(deviceOsState.getMachineId())
                .orOperator(neverReceived, receivedEarlier);
        return Query.query(ofMachine);
    }
}
