package com.openframe.processing.version;

import com.mongodb.ReadPreference;
import com.openframe.processing.version.ProjectionVersion.Fields;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

// Not a Spring Data repository: saveVersionIfHigher needs $max in an upsert. Read from the primary: a secondary's older copy would let an older event through.
@RequiredArgsConstructor
public class ProjectionVersionRepository {

    // Below every event version, 0 included.
    public static final long NO_VERSION = -1;

    private final MongoOperations mongoOperations;

    public long findStoredVersion(String projection, String tenantId, String aggregateId) {
        String id = ProjectionVersion.idOf(projection, tenantId, aggregateId);
        Criteria byId = Criteria.where(Fields.id).is(id);
        Query query = Query.query(byId);
        query.fields().include(Fields.version);
        query.withReadPreference(ReadPreference.primary());
        ProjectionVersion stored = mongoOperations.findOne(query, ProjectionVersion.class);
        return stored == null ? NO_VERSION : stored.getVersion();
    }

    // One atomic upsert; $max keeps the higher version when an older event is stored after a newer one.
    public void saveVersionIfHigher(String projection, String tenantId, String aggregateId, long version) {
        String id = ProjectionVersion.idOf(projection, tenantId, aggregateId);
        Criteria byId = Criteria.where(Fields.id).is(id);
        Query query = Query.query(byId);
        Update update = new Update()
                .max(Fields.version, version)
                .setOnInsert(Fields.projection, projection)
                .setOnInsert(Fields.tenantId, tenantId)
                .setOnInsert(Fields.aggregateId, aggregateId)
                .currentDate(Fields.updatedAt);
        mongoOperations.upsert(query, update, ProjectionVersion.class);
    }
}
