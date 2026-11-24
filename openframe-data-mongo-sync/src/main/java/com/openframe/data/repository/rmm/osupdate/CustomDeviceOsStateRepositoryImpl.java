package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class CustomDeviceOsStateRepositoryImpl implements CustomDeviceOsStateRepository {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_MANAGEABILITY_STATE = "manageability.state";

    private final MongoTemplate mongoTemplate;

    @Override
    public List<String> findMachineIds(String tenantId, OsUpdateManageabilityState manageabilityState) {
        Criteria inState = Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_MANAGEABILITY_STATE).is(manageabilityState);
        Query query = Query.query(inState);
        return mongoTemplate.findDistinct(query, FIELD_MACHINE_ID, DeviceOsState.class, String.class);
    }
}
