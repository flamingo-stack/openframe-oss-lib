package com.openframe.data.repository.rmm.osupdate;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
@RequiredArgsConstructor
public class CustomDeviceOsStateRepositoryImpl implements CustomDeviceOsStateRepository {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_OS_VERSION = "osVersion";
    private static final String FIELD_OS_BUILD = "osBuild";
    private static final String FIELD_RESTART_PENDING = "restartPending";
    private static final String FIELD_RESTART_PENDING_SINCE = "restartPendingSince";
    private static final String FIELD_LAST_SCAN_AT = "lastScanAt";
    private static final String FIELD_LAST_SCAN_ERROR = "lastScanError";
    private static final String FIELD_LAST_INSTALLED_AT = "lastInstalledAt";
    private static final String FIELD_MANAGEMENT_STATE = "managementState";
    private static final String FIELD_MANAGED_ELSEWHERE_REASON = "managedElsewhereReason";
    private static final String FIELD_OBSERVED_REASON = "observedReason";
    private static final String FIELD_AUTHORIZATION = "authorization";
    private static final String FIELD_RECEIVED_AT = "receivedAt";

    private final MongoTemplate mongoTemplate;

    // false = a newer report holds the document. The filter is the ordering guard: when it misses a stored document
    // the upsert tries an insert, which the unique {tenantId, machineId} index refuses.
    @Override
    public boolean upsertUnlessNewerStored(DeviceOsState state) {
        Query storedNotNewer = storedNotNewer(state);
        Update update = toUpdate(state);
        try {
            mongoTemplate.upsert(storedNotNewer, update, DeviceOsState.class);
            return true;
        } catch (DuplicateKeyException documentExists) {
            // a newer report holds the document, or another pod inserted it a moment ago
            UpdateResult result = mongoTemplate.updateFirst(storedNotNewer, update, DeviceOsState.class);
            return result.getMatchedCount() > 0;
        }
    }

    private static Query storedNotNewer(DeviceOsState state) {
        Instant receivedAt = state.getReceivedAt();
        Criteria neverReceived = Criteria.where(FIELD_RECEIVED_AT).isNull();
        Criteria receivedEarlier = Criteria.where(FIELD_RECEIVED_AT).lte(receivedAt);
        Criteria ofMachine = Criteria.where(FIELD_TENANT_ID).is(state.getTenantId())
                .and(FIELD_MACHINE_ID).is(state.getMachineId())
                .orOperator(neverReceived, receivedEarlier);
        return Query.query(ofMachine);
    }

    // A null value is unset: an Update never writes a null, and what an older report stored must not survive.
    // Version and build are the exception: a report without them keeps the stored ones.
    private static Update toUpdate(DeviceOsState state) {
        Update update = new Update().set(FIELD_RECEIVED_AT, state.getReceivedAt());
        setWhenPresent(update, FIELD_OS_VERSION, state.getOsVersion());
        setWhenPresent(update, FIELD_OS_BUILD, state.getOsBuild());
        setOrUnset(update, FIELD_RESTART_PENDING, state.getRestartPending());
        setOrUnset(update, FIELD_RESTART_PENDING_SINCE, state.getRestartPendingSince());
        setOrUnset(update, FIELD_LAST_SCAN_AT, state.getLastScanAt());
        setOrUnset(update, FIELD_LAST_SCAN_ERROR, state.getLastScanError());
        setOrUnset(update, FIELD_LAST_INSTALLED_AT, state.getLastInstalledAt());
        setOrUnset(update, FIELD_MANAGEMENT_STATE, state.getManagementState());
        setOrUnset(update, FIELD_MANAGED_ELSEWHERE_REASON, state.getManagedElsewhereReason());
        setOrUnset(update, FIELD_OBSERVED_REASON, state.getObservedReason());
        setOrUnset(update, FIELD_AUTHORIZATION, state.getAuthorization());
        return update;
    }

    private static void setWhenPresent(Update update, String field, Object value) {
        if (value != null) {
            update.set(field, value);
        }
    }

    private static void setOrUnset(Update update, String field, Object value) {
        if (value != null) {
            update.set(field, value);
            return;
        }
        update.unset(field);
    }
}
