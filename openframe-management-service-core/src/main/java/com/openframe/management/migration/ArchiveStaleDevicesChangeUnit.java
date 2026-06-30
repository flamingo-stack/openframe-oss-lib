package com.openframe.management.migration;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
// TODO(device-cleanup-rollout): drop runAlways=true after flag is permanently on — body becomes a normal one-shot migration
@ChangeUnit(id = "archive-stale-devices", order = "005", author = "openframe", runAlways = true)
public class ArchiveStaleDevicesChangeUnit {

    private static final String ARCHIVE_STALE_FLAG = "openframe.features.devices.archive-stale.enabled";

    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String STATUS_FIELD = "status";
    private static final String LAST_SEEN_FIELD = "lastSeen";
    private static final String UPDATED_AT_FIELD = "updatedAt";

    // Only operationally live devices are touched — never PENDING/INACTIVE/MAINTENANCE/
    // DECOMMISSIONED/DELETED/ARCHIVED, so terminal states are preserved.
    private static final List<DeviceStatus> MANAGED_STATUSES = List.of(DeviceStatus.ONLINE, DeviceStatus.OFFLINE);

    private static final long STALE_THRESHOLD_DAYS = 14;

    @Execution
    public void execution(MongoTemplate mongoTemplate, Environment environment, TenantIdProvider tenantIdProvider) {
        // TODO(device-cleanup-rollout): remove flag guard + drop Environment param after rollout
        if (!isEnabled(environment)) {
            log.info("Archive stale devices: feature disabled; skipping");
            return;
        }
        String tenantId = tenantIdProvider.getTenantId();
        archiveStaleDevices(mongoTemplate, tenantId);
    }

    private boolean isEnabled(Environment environment) {
        return environment.getProperty(ARCHIVE_STALE_FLAG, Boolean.class, false);
    }

    @RollbackExecution
    public void rollback() {
    }

    private void archiveStaleDevices(MongoTemplate mongoTemplate, String tenantId) {
        Instant threshold = Instant.now().minus(STALE_THRESHOLD_DAYS, ChronoUnit.DAYS);
        Query query = new Query(activeDevices(tenantId).and(LAST_SEEN_FIELD).lt(threshold));
        UpdateResult result = mongoTemplate.updateMulti(query, archiveUpdate(), Machine.class);
        log.info("Archived {} device(s) not seen for over {} days",
                result.getModifiedCount(), STALE_THRESHOLD_DAYS);
    }

    private Criteria activeDevices(String tenantId) {
        return Criteria.where(TENANT_ID_FIELD).is(tenantId)
                .and(STATUS_FIELD).in(MANAGED_STATUSES);
    }

    private Update archiveUpdate() {
        Instant now = Instant.now();
        return new Update()
                .set(STATUS_FIELD, DeviceStatus.ARCHIVED)
                .set(UPDATED_AT_FIELD, now);
    }
}
