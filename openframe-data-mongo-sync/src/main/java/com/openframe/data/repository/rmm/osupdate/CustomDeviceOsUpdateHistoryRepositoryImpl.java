package com.openframe.data.repository.rmm.osupdate;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Repository
@RequiredArgsConstructor
public class CustomDeviceOsUpdateHistoryRepositoryImpl implements CustomDeviceOsUpdateHistoryRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_INSTALLED_AT = "installedAt";
    private static final String CURSOR_SEPARATOR = "|";
    private static final Sort NEWEST_INSTALLED_FIRST = Sort.by(Sort.Direction.DESC, FIELD_INSTALLED_AT, FIELD_ID);

    private final MongoTemplate mongoTemplate;

    @Override
    public List<DeviceOsUpdateHistoryEntry> findPage(String tenantId, String machineId, String cursor, int limit) {
        Criteria page = after(ofMachine(tenantId, machineId), cursor);
        Query query = Query.query(page).with(NEWEST_INSTALLED_FIRST).limit(limit);
        return mongoTemplate.find(query, DeviceOsUpdateHistoryEntry.class);
    }

    @Override
    public String encodeCursor(DeviceOsUpdateHistoryEntry historyEntry) {
        return historyEntry.getInstalledAt().toEpochMilli() + CURSOR_SEPARATOR + historyEntry.getId();
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
        Instant installedAt = parseInstant(cursor.substring(0, separator));
        ObjectId id = parseId(cursor.substring(separator + 1));
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
