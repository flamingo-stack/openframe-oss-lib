package com.openframe.management.migration;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.core.env.Environment;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;

@Slf4j
// TODO(device-cleanup-rollout): drop runAlways=true after flag is permanently on — body becomes a normal one-shot migration
@ChangeUnit(id = "archive-stale-devices", order = "005", author = "openframe", runAlways = true)
public class ArchiveStaleDevicesChangeUnit {

    private static final String CHANGE_ID = "archive-stale-devices";
    private static final String ARCHIVE_STALE_FLAG = "openframe.features.devices.archive-stale.enabled";

    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String STATUS_FIELD = "status";
    private static final String LAST_SEEN_FIELD = "lastSeen";
    private static final String UPDATED_AT_FIELD = "updatedAt";
    private static final String MIGRATION_DATA_FIELD = "migrationData";

    // Only operationally live devices are touched — never PENDING/INACTIVE/MAINTENANCE/
    // DECOMMISSIONED/DELETED/ARCHIVED, so terminal states are preserved.
    private static final List<DeviceStatus> MANAGED_STATUSES = List.of(DeviceStatus.OFFLINE);

    private static final int DAYS_PER_WEEK = 7;
    private static final long STALE_THRESHOLD_WEEKS = 1;

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
        long thresholdDays = STALE_THRESHOLD_WEEKS * DAYS_PER_WEEK;
        Instant threshold = Instant.now().minus(thresholdDays, ChronoUnit.DAYS);
        long archived = MANAGED_STATUSES.stream()
                .mapToLong(status -> archiveStaleWithStatus(mongoTemplate, tenantId, status, threshold))
                .sum();
        log.info("Archived {} device(s) not seen for over {} weeks", archived, STALE_THRESHOLD_WEEKS);
    }

    private long archiveStaleWithStatus(MongoTemplate mongoTemplate, String tenantId,
                                        DeviceStatus previousStatus, Instant threshold) {
        Query query = new Query(Criteria.where(TENANT_ID_FIELD).is(tenantId)
                .and(STATUS_FIELD).is(previousStatus)
                .and(LAST_SEEN_FIELD).lt(threshold));
        Update update = archiveUpdate(previousStatus);
        UpdateResult result = mongoTemplate.updateMulti(query, update, Machine.class);
        return result.getModifiedCount();
    }

    private Update archiveUpdate(DeviceStatus previousStatus) {
        Instant now = Instant.now();
        Document migrationData = new Document()
                .append("archivedBy", CHANGE_ID)
                .append("previousStatus", previousStatus.name())
                .append("archivedAt", Date.from(now));
        return new Update()
                .set(STATUS_FIELD, DeviceStatus.ARCHIVED)
                .set(MIGRATION_DATA_FIELD, migrationData)
                .set(UPDATED_AT_FIELD, now);
    }
}
