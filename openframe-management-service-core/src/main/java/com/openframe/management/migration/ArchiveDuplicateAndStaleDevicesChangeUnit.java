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
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.springframework.data.mongodb.core.aggregation.Aggregation.group;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.match;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.newAggregation;
import static org.springframework.util.CollectionUtils.isEmpty;

@Slf4j
// TODO(device-cleanup-rollout): drop runAlways=true after flag is permanently on — body becomes a normal one-shot migration
@ChangeUnit(id = "archive-duplicate-and-stale-devices", order = "005", author = "openframe", runAlways = true)
public class ArchiveDuplicateAndStaleDevicesChangeUnit {

    private static final String ARCHIVE_CLEANUP_FLAG = "openframe.features.devices.archive-cleanup.enabled";

    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String HOSTNAME_FIELD = "hostname";
    private static final String STATUS_FIELD = "status";
    private static final String LAST_SEEN_FIELD = "lastSeen";
    private static final String REGISTERED_AT_FIELD = "registeredAt";
    private static final String UPDATED_AT_FIELD = "updatedAt";
    private static final String ID_FIELD = "_id";
    private static final String COUNT_FIELD = "count";
    private static final String NON_BLANK_PATTERN = "\\S";

    // Only operationally live devices are touched — never PENDING/INACTIVE/MAINTENANCE/
    // DECOMMISSIONED/DELETED/ARCHIVED, so terminal states are preserved.
    private static final List<DeviceStatus> MANAGED_STATUSES = List.of(DeviceStatus.ONLINE, DeviceStatus.OFFLINE);

    private static final long STALE_THRESHOLD_DAYS = 1;

    @Execution
    public void execution(MongoTemplate mongoTemplate, Environment environment, TenantIdProvider tenantIdProvider) {
        // TODO(device-cleanup-rollout): remove flag guard + drop Environment param after rollout
        if (!isArchiveCleanupEnabled(environment)) {
            log.info("Archive device cleanup: feature disabled; skipping");
            return;
        }
        String tenantId = tenantIdProvider.getTenantId();
        archiveHostnameDuplicates(mongoTemplate, tenantId);
        archiveStaleDevices(mongoTemplate, tenantId);
    }

    private boolean isArchiveCleanupEnabled(Environment environment) {
        return environment.getProperty(ARCHIVE_CLEANUP_FLAG, Boolean.class, false);
    }

    @RollbackExecution
    public void rollback() {
    }

    private void archiveHostnameDuplicates(MongoTemplate mongoTemplate, String tenantId) {
        List<String> duplicatedHostnames = findDuplicatedHostnames(mongoTemplate, tenantId);
        int archived = duplicatedHostnames.stream()
                .mapToInt(hostname -> archiveOlderDuplicates(mongoTemplate, tenantId, hostname))
                .sum();
        log.info("Archived {} duplicate device(s) across {} hostname group(s)",
                archived, duplicatedHostnames.size());
    }

    private List<String> findDuplicatedHostnames(MongoTemplate mongoTemplate, String tenantId) {
        Criteria withNonBlankHostname = activeDevices(tenantId).and(HOSTNAME_FIELD).regex(NON_BLANK_PATTERN);
        Aggregation aggregation = newAggregation(
                match(withNonBlankHostname),
                group(HOSTNAME_FIELD).count().as(COUNT_FIELD),
                match(Criteria.where(COUNT_FIELD).gt(1)));
        AggregationResults<Document> results =
                mongoTemplate.aggregate(aggregation, Machine.class, Document.class);
        return results.getMappedResults().stream()
                .map(group -> group.getString(ID_FIELD))
                .toList();
    }

    private int archiveOlderDuplicates(MongoTemplate mongoTemplate, String tenantId, String hostname) {
        Query query = new Query(activeDevices(tenantId).and(HOSTNAME_FIELD).is(hostname));
        query.with(Sort.by(Sort.Direction.DESC, REGISTERED_AT_FIELD));
        List<Machine> machines = mongoTemplate.find(query, Machine.class);

        List<String> idsToArchive = machines.stream()
                .skip(1)
                .map(Machine::getId)
                .toList();
        archiveByIds(mongoTemplate, idsToArchive);
        return idsToArchive.size();
    }

    private void archiveByIds(MongoTemplate mongoTemplate, List<String> ids) {
        if (isEmpty(ids)) {
            return;
        }
        Query query = new Query(Criteria.where(ID_FIELD).in(ids));
        mongoTemplate.updateMulti(query, archiveUpdate(), Machine.class);
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
