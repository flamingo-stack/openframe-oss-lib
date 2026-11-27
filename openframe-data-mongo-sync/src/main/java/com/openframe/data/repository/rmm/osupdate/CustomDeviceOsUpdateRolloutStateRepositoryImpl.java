package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateRolloutState;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class CustomDeviceOsUpdateRolloutStateRepositoryImpl implements CustomDeviceOsUpdateRolloutStateRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_ORGANIZATION_ID = "organizationId";
    private static final String FIELD_INSTALL_FROM = "installFrom";
    private static final String FIELD_HARD_AT = "hardAt";
    private static final String FIELD_DEVICE_COUNT = "deviceCount";
    private static final String FIELD_TELEMETRY_STATUS = "telemetryStatus";

    private final MongoTemplate mongoTemplate;

    @Override
    public long countDevicesWithInstallDue(String tenantId, Collection<String> organizationIds,
                                                           Instant now) {
        Criteria installDue = ofCustomers(tenantId, organizationIds).and(FIELD_INSTALL_FROM).lte(now);
        Aggregation devicesWithInstallDue = Aggregation.newAggregation(
                Aggregation.match(installDue),
                Aggregation.group(FIELD_MACHINE_ID),
                Aggregation.count().as(FIELD_DEVICE_COUNT));
        List<Document> deviceCounts = mongoTemplate.aggregate(devicesWithInstallDue,
                DeviceOsUpdateRolloutState.class, Document.class).getMappedResults();
        return deviceCounts.isEmpty() ? 0 : deviceCounts.getFirst().get(FIELD_DEVICE_COUNT, Number.class).longValue();
    }

    // A device that sent no heartbeat yet has no connectivity and counts as offline.
    @Override
    public OsUpdateOverdueDeviceCounts countOverdueDevices(String tenantId, Collection<String> organizationIds,
                                                           Instant now) {
        Criteria overdue = ofCustomers(tenantId, organizationIds).and(FIELD_HARD_AT).lt(now);
        List<String> overdueMachineIds = mongoTemplate.findDistinct(
                Query.query(overdue), FIELD_MACHINE_ID, DeviceOsUpdateRolloutState.class, String.class);
        if (overdueMachineIds.isEmpty()) {
            return OsUpdateOverdueDeviceCounts.NONE;
        }
        Criteria onlineOfThem = Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_MACHINE_ID).in(overdueMachineIds)
                .and(FIELD_TELEMETRY_STATUS).is(TelemetryStatus.ONLINE);
        long onlineDeviceCount = mongoTemplate.count(Query.query(onlineOfThem), Machine.class);
        return new OsUpdateOverdueDeviceCounts(overdueMachineIds.size(), overdueMachineIds.size() - onlineDeviceCount);
    }

    private static Criteria ofCustomers(String tenantId, Collection<String> organizationIds) {
        Criteria ofTenant = Criteria.where(FIELD_TENANT_ID).is(tenantId);
        return organizationIds.isEmpty() ? ofTenant : ofTenant.and(FIELD_ORGANIZATION_ID).in(organizationIds);
    }
}
