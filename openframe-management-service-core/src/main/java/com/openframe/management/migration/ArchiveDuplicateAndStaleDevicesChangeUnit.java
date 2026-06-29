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
@ChangeUnit(id = "archive-duplicate-and-stale-devices", order = "005", author = "openframe", runAlways = true)
public class ArchiveDuplicateAndStaleDevicesChangeUnit {

    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String HOSTNAME_FIELD = "hostname";
    private static final String STATUS_FIELD = "status";
    private static final String LAST_SEEN_FIELD = "lastSeen";
    private static final String REGISTERED_AT_FIELD = "registeredAt";
    private static final String UPDATED_AT_FIELD = "updatedAt";
    private static final String ID_FIELD = "_id";
    private static final String COUNT_FIELD = "count";

    private static final long STALE_THRESHOLD_DAYS = 1;

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        archiveHostnameDuplicates(mongoTemplate, tenantId);
        archiveStaleDevices(mongoTemplate, tenantId);
    }

    @RollbackExecution
    public void rollback() {
    }

    private void archiveHostnameDuplicates(MongoTemplate mongoTemplate, String tenantId) {
        List<String> duplicatedHostnames = findDuplicatedHostnames(mongoTemplate, tenantId);
        duplicatedHostnames.forEach(hostname -> archiveOlderDuplicates(mongoTemplate, tenantId, hostname));
    }

    private List<String> findDuplicatedHostnames(MongoTemplate mongoTemplate, String tenantId) {
        Aggregation aggregation = newAggregation(
                match(activeWithHostname(tenantId)),
                group(HOSTNAME_FIELD).count().as(COUNT_FIELD),
                match(Criteria.where(COUNT_FIELD).gt(1)));
        AggregationResults<Document> results =
                mongoTemplate.aggregate(aggregation, Machine.class, Document.class);
        return results.getMappedResults().stream()
                .map(group -> group.getString(ID_FIELD))
                .toList();
    }

    private void archiveOlderDuplicates(MongoTemplate mongoTemplate, String tenantId, String hostname) {
        Query query = new Query(activeWithHostname(tenantId).and(HOSTNAME_FIELD).is(hostname));
        query.with(Sort.by(Sort.Direction.DESC, REGISTERED_AT_FIELD));
        List<Machine> machines = mongoTemplate.find(query, Machine.class);

        List<String> idsToArchive = machines.stream()
                .skip(1)
                .map(Machine::getId)
                .toList();
        archiveByIds(mongoTemplate, idsToArchive);
        log.info("Archived {} duplicate device(s) for hostname {}", idsToArchive.size(), hostname);
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
        Query query = new Query(Criteria.where(TENANT_ID_FIELD).is(tenantId)
                .and(STATUS_FIELD).ne(DeviceStatus.ARCHIVED)
                .and(LAST_SEEN_FIELD).lt(threshold));
        UpdateResult result = mongoTemplate.updateMulti(query, archiveUpdate(), Machine.class);
        log.info("Archived {} device(s) not seen for over {} days",
                result.getModifiedCount(), STALE_THRESHOLD_DAYS);
    }

    private Criteria activeWithHostname(String tenantId) {
        return Criteria.where(TENANT_ID_FIELD).is(tenantId)
                .and(STATUS_FIELD).ne(DeviceStatus.ARCHIVED)
                .and(HOSTNAME_FIELD).ne(null);
    }

    private Update archiveUpdate() {
        Instant now = Instant.now();
        return new Update()
                .set(STATUS_FIELD, DeviceStatus.ARCHIVED)
                .set(UPDATED_AT_FIELD, now);
    }
}
