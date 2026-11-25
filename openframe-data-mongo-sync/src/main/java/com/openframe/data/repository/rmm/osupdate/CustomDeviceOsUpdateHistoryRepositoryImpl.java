package com.openframe.data.repository.rmm.osupdate;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.aggregation.GroupOperation;
import org.springframework.data.mongodb.core.aggregation.LimitOperation;
import org.springframework.data.mongodb.core.aggregation.MatchOperation;
import org.springframework.data.mongodb.core.aggregation.SortOperation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Repository
@RequiredArgsConstructor
public class CustomDeviceOsUpdateHistoryRepositoryImpl implements CustomDeviceOsUpdateHistoryRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_INSTALLED_AT = "installedAt";
    private static final String FIELD_IDENTIFIER = "identifier";
    private static final String FIELD_OPERATION = "operation";
    private static final String FIELD_RESULT = "result";
    private static final List<OsUpdateInstallResult> INSTALLED_RESULTS =
            List.of(OsUpdateInstallResult.SUCCEEDED, OsUpdateInstallResult.SUCCEEDED_WITH_ERRORS);
    private static final String CURSOR_SEPARATOR = "|";
    private static final Sort NEWEST_INSTALLED_FIRST = Sort.by(Sort.Direction.DESC, FIELD_INSTALLED_AT, FIELD_ID);

    private final MongoTemplate mongoTemplate;

    @Override
    public List<DeviceOsUpdateHistoryEntry> findPage(String tenantId, String machineId, String cursor, int limit) {
        Criteria ofMachine = ofMachine(tenantId, machineId);
        Criteria page = after(ofMachine, cursor);
        Query query = Query.query(page).with(NEWEST_INSTALLED_FIRST).limit(limit);
        return mongoTemplate.find(query, DeviceOsUpdateHistoryEntry.class);
    }

    @Override
    public String encodeCursor(DeviceOsUpdateHistoryEntry historyEntry) {
        return historyEntry.getInstalledAt().toEpochMilli() + CURSOR_SEPARATOR + historyEntry.getId();
    }

    // One row per device: its latest successful install of the update.
    @Override
    public List<InstalledOsUpdateDevice> findInstalledDevicePage(String tenantId, String identifier,
                                                                 Collection<String> machineIds, String cursor,
                                                                 int limit) {
        Criteria installs = installs(tenantId).and(FIELD_IDENTIFIER).is(identifier);
        if (machineIds != null) {
            installs = installs.and(FIELD_MACHINE_ID).in(machineIds);
        }
        MatchOperation matchInstalls = Aggregation.match(installs);
        GroupOperation latestPerDevice =
                Aggregation.group(FIELD_MACHINE_ID).max(FIELD_INSTALLED_AT).as(FIELD_INSTALLED_AT);
        SortOperation newestInstalledFirst = Aggregation.sort(NEWEST_INSTALLED_FIRST);
        LimitOperation pageSize = Aggregation.limit(limit);
        List<AggregationOperation> stages = new ArrayList<>();
        stages.add(matchInstalls);
        stages.add(latestPerDevice);
        if (!isBlank(cursor)) {
            Criteria afterCursor = afterInstalledDevice(cursor);
            MatchOperation matchAfterCursor = Aggregation.match(afterCursor);
            stages.add(matchAfterCursor);
        }
        stages.add(newestInstalledFirst);
        stages.add(pageSize);
        Aggregation installedDevicePage = Aggregation.newAggregation(stages);
        AggregationResults<InstalledOsUpdateDevice> installedDevices = mongoTemplate.aggregate(
                installedDevicePage, DeviceOsUpdateHistoryEntry.class, InstalledOsUpdateDevice.class);
        return installedDevices.getMappedResults();
    }

    @Override
    public String encodeInstalledDeviceCursor(InstalledOsUpdateDevice installedDevice) {
        Instant installedAt = installedDevice.getInstalledAt();
        String machineId = installedDevice.getMachineId();
        return OsUpdateKeysetCursor.encode(installedAt, machineId);
    }

    private static Criteria installs(String tenantId) {
        return Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_OPERATION).is(OsUpdateOperation.INSTALL)
                .and(FIELD_RESULT).in(INSTALLED_RESULTS);
    }

    // After the grouping the machine id is the row's _id.
    private static Criteria afterInstalledDevice(String cursor) {
        OsUpdateKeysetCursor keysetCursor = OsUpdateKeysetCursor.parse(cursor);
        Instant installedAt = keysetCursor.getInstant();
        String machineId = keysetCursor.getKey();
        Criteria installedEarlier = Criteria.where(FIELD_INSTALLED_AT).lt(installedAt);
        Criteria installedTogetherLowerMachineId =
                Criteria.where(FIELD_INSTALLED_AT).is(installedAt).and(FIELD_ID).lt(machineId);
        return new Criteria().orOperator(installedEarlier, installedTogetherLowerMachineId);
    }

    private static Criteria ofMachine(String tenantId, String machineId) {
        return Criteria.where(FIELD_TENANT_ID).is(tenantId).and(FIELD_MACHINE_ID).is(machineId);
    }

    private static Criteria after(Criteria base, String cursor) {
        if (isBlank(cursor)) {
            return base;
        }
        int separator = cursor.lastIndexOf(CURSOR_SEPARATOR);
        if (separator < 0) {
            throw new BadRequestException("Invalid OS update history cursor (no separator): " + cursor);
        }
        String installedAtMillis = cursor.substring(0, separator);
        String idHex = cursor.substring(separator + 1);
        Instant installedAt = parseInstant(installedAtMillis);
        ObjectId id = parseId(idHex);
        Criteria olderInstall = Criteria.where(FIELD_INSTALLED_AT).lt(installedAt);
        Criteria sameInstallOlderId = Criteria.where(FIELD_INSTALLED_AT).is(installedAt).and(FIELD_ID).lt(id);
        Criteria keyset = new Criteria().orOperator(olderInstall, sameInstallOlderId);
        return new Criteria().andOperator(base, keyset);
    }

    private static Instant parseInstant(String millis) {
        try {
            return Instant.ofEpochMilli(Long.parseLong(millis));
        } catch (NumberFormatException e) {
            throw new BadRequestException("Unparseable epoch millis in OS update history cursor: " + millis);
        }
    }

    private static ObjectId parseId(String hex) {
        try {
            return new ObjectId(hex);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid ObjectId in OS update history cursor: " + hex);
        }
    }
}
