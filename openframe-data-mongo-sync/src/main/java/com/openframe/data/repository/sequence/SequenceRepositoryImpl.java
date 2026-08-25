package com.openframe.data.repository.sequence;

import com.openframe.data.document.sequence.TenantSequence;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

/**
 * TenantScoped sequence counter. TenantAwareMongoTemplate auto-scopes the
 * findAndModify query by tenantId — no composite key needed.
 * Only active on tenant pods (openframe.tenant-isolation.enabled=true).
 */
@Slf4j
@Repository
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class SequenceRepositoryImpl implements SequenceRepository {

    private final TenantAwareMongoTemplate mongoTemplate;

    @Override
    public int getNextValue(String sequenceName) {
        Query query = new Query(Criteria.where("name").is(sequenceName));
        Update update = new Update().inc("value", 1);
        FindAndModifyOptions options = FindAndModifyOptions.options()
                .returnNew(true)
                .upsert(true);

        // TenantAwareMongoTemplate injects tenantId into the query automatically
        // since TenantSequence implements TenantScoped.
        // TenantStampingCallback stamps tenantId on the upserted document.
        TenantSequence result = mongoTemplate.findAndModify(
                query, update, options, TenantSequence.class);

        int value = result.getValue();
        log.debug("Sequence '{}' incremented to: {}", sequenceName, value);
        return value;
    }
}
