package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateRolloutState;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Repository;

import java.time.Instant;
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
    private static final String FIELD_OFFLINE_DEVICE_COUNT = "offlineDeviceCount";
    private static final String MACHINE_TELEMETRY_STATUS = "$" + OsUpdateMachineStages.FIELD_MACHINE + ".telemetryStatus";

    private final MongoTemplate mongoTemplate;

    @Override
    public long countDevicesWithInstallDue(String tenantId, String organizationId, Instant now) {
        Criteria installDue = ofCustomer(tenantId, organizationId).and(FIELD_INSTALL_FROM).lte(now);
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
    public OsUpdateOverdueDeviceCounts countOverdueDevices(String tenantId, String organizationId, Instant now) {
        Criteria overdue = ofCustomer(tenantId, organizationId).and(FIELD_HARD_AT).lt(now);
        Document telemetryStatus = new Document("$arrayElemAt", List.of(MACHINE_TELEMETRY_STATUS, 0));
        Document notOnline = new Document("$ne", List.of(telemetryStatus, TelemetryStatus.ONLINE.name()));
        Document offlineOrNot = new Document("$cond", List.of(notOnline, 1, 0));
        Document overdueDeviceCounts = new Document("$group", new Document(FIELD_ID, null)
                .append(FIELD_DEVICE_COUNT, new Document("$sum", 1))
                .append(FIELD_OFFLINE_DEVICE_COUNT, new Document("$sum", offlineOrNot)));
        List<AggregationOperation> stages = List.of(
                Aggregation.match(overdue),
                Aggregation.group(FIELD_MACHINE_ID),
                OsUpdateMachineStages.lookupMachineOfGroup(tenantId),
                context -> overdueDeviceCounts);
        List<OsUpdateOverdueDeviceCounts> deviceCounts = mongoTemplate.aggregate(Aggregation.newAggregation(stages),
                DeviceOsUpdateRolloutState.class, OsUpdateOverdueDeviceCounts.class).getMappedResults();
        return deviceCounts.isEmpty() ? OsUpdateOverdueDeviceCounts.NONE : deviceCounts.getFirst();
    }

    private static Criteria ofCustomer(String tenantId, String organizationId) {
        Criteria ofTenant = Criteria.where(FIELD_TENANT_ID).is(tenantId);
        return organizationId == null ? ofTenant : ofTenant.and(FIELD_ORGANIZATION_ID).is(organizationId);
    }
}
