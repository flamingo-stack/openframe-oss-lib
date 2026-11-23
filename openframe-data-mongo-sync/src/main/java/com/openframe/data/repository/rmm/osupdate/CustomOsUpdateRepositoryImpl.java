package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class CustomOsUpdateRepositoryImpl implements CustomOsUpdateRepository {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_PLATFORM = "platform";
    private static final String FIELD_IDENTIFIER = "identifier";

    private final MongoTemplate mongoTemplate;

    @Override
    public void insertMissing(List<OsUpdate> osUpdates) {
        if (osUpdates.isEmpty()) {
            return;
        }
        BulkOperations bulkOperations = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, OsUpdate.class);
        osUpdates.forEach(osUpdate -> bulkOperations.upsert(sameUpdate(osUpdate), insertIfAbsent(osUpdate)));
        bulkOperations.execute();
    }

    private static Query sameUpdate(OsUpdate osUpdate) {
        Criteria sameUpdate = Criteria.where(FIELD_TENANT_ID).is(osUpdate.getTenantId())
                .and(FIELD_PLATFORM).is(osUpdate.getPlatform())
                .and(FIELD_IDENTIFIER).is(osUpdate.getIdentifier());
        return Query.query(sameUpdate);
    }

    private Update insertIfAbsent(OsUpdate osUpdate) {
        return InsertIfAbsentUpdate.of(mongoTemplate.getConverter(), osUpdate);
    }
}
