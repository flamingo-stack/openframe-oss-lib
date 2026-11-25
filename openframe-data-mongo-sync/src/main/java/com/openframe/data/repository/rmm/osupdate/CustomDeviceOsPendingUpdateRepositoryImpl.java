package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Repository
@RequiredArgsConstructor
public class CustomDeviceOsPendingUpdateRepositoryImpl implements CustomDeviceOsPendingUpdateRepository {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_PLATFORM = "platform";
    private static final String FIELD_IDENTIFIER = "identifier";
    private static final String FIELD_DISCOVERED_AT = "discoveredAt";
    private static final Sort NEWEST_DISCOVERED_FIRST =
            Sort.by(Sort.Direction.DESC, FIELD_DISCOVERED_AT, FIELD_MACHINE_ID);

    private final MongoTemplate mongoTemplate;

    @Override
    public List<DeviceOsPendingUpdate> findDevicePage(String tenantId, OsPlatform platform, String identifier,
                                                      Collection<String> excludedMachineIds, String cursor,
                                                      int limit) {
        Criteria pendingOnListedDevices = Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_PLATFORM).is(platform)
                .and(FIELD_IDENTIFIER).is(identifier);
        Criteria notExcluded = Criteria.where(FIELD_MACHINE_ID).nin(excludedMachineIds);
        Criteria page = new Criteria().andOperator(pendingOnListedDevices, notExcluded);
        if (!isBlank(cursor)) {
            Criteria afterCursor = after(cursor);
            page = new Criteria().andOperator(pendingOnListedDevices, notExcluded, afterCursor);
        }
        Query query = Query.query(page).with(NEWEST_DISCOVERED_FIRST).limit(limit);
        return mongoTemplate.find(query, DeviceOsPendingUpdate.class);
    }

    @Override
    public String encodeDeviceCursor(DeviceOsPendingUpdate pendingUpdate) {
        Instant discoveredAt = pendingUpdate.getDiscoveredAt();
        String machineId = pendingUpdate.getMachineId();
        return OsUpdateKeysetCursor.encode(discoveredAt, machineId);
    }

    private static Criteria after(String cursor) {
        OsUpdateKeysetCursor keysetCursor = OsUpdateKeysetCursor.parse(cursor);
        Instant discoveredAt = keysetCursor.getInstant();
        String machineId = keysetCursor.getKey();
        Criteria discoveredEarlier = Criteria.where(FIELD_DISCOVERED_AT).lt(discoveredAt);
        Criteria discoveredTogetherLowerMachineId =
                Criteria.where(FIELD_DISCOVERED_AT).is(discoveredAt).and(FIELD_MACHINE_ID).lt(machineId);
        return new Criteria().orOperator(discoveredEarlier, discoveredTogetherLowerMachineId);
    }
}
