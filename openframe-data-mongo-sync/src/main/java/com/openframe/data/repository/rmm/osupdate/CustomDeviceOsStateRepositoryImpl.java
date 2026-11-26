package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.TypedAggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Repository
@RequiredArgsConstructor
public class CustomDeviceOsStateRepositoryImpl implements CustomDeviceOsStateRepository {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_PLATFORM = "platform";
    private static final String FIELD_OS_VERSION = "osVersion";
    private static final String FIELD_OS_BUILD = "osBuild";
    private static final String FIELD_DEVICE_COUNT = "deviceCount";
    private static final String FIELD_OS_VERSION_BUILD_COUNTS = "osVersionBuildCounts";
    private static final String GROUPED_OS_BUILD = "$_id.osBuild";
    private static final String ID = "_id";

    private final MongoTemplate mongoTemplate;

    @Override
    public List<OsVersionDeviceCounts> findOsVersionPage(OsPlatform platform, Collection<String> machineIds,
                                                         String cursor, int limit, String tenantId) {
        List<Criteria> conditions = new ArrayList<>();
        conditions.add(Criteria.where(FIELD_TENANT_ID).is(tenantId).and(FIELD_PLATFORM).is(platform));
        Criteria withOsVersion = Criteria.where(FIELD_OS_VERSION).ne(null);
        conditions.add(isBlank(cursor) ? withOsVersion : withOsVersion.lt(cursor));
        if (machineIds != null) {
            conditions.add(Criteria.where(FIELD_MACHINE_ID).in(machineIds));
        }
        Document buildCount = new Document(FIELD_OS_BUILD, GROUPED_OS_BUILD)
                .append(FIELD_DEVICE_COUNT, "$" + FIELD_DEVICE_COUNT);
        TypedAggregation<DeviceOsState> osVersionPage = Aggregation.newAggregation(DeviceOsState.class,
                Aggregation.match(new Criteria().andOperator(conditions)),
                Aggregation.group(FIELD_OS_VERSION, FIELD_OS_BUILD).count().as(FIELD_DEVICE_COUNT),
                Aggregation.group(FIELD_OS_VERSION).push(buildCount).as(FIELD_OS_VERSION_BUILD_COUNTS),
                Aggregation.sort(Sort.Direction.DESC, ID),
                Aggregation.limit(limit));
        return mongoTemplate.aggregate(osVersionPage, OsVersionDeviceCounts.class).getMappedResults();
    }
}
