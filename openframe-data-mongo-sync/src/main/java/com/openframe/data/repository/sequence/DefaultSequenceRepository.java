package com.openframe.data.repository.sequence;

import com.openframe.data.document.sequence.TenantSequence;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

/**
 * Counter repository for deployments without tenant isolation (single-tenant/OSS pods): one
 * counter document per sequence name, no tenant scoping. Tenant pods use
 * {@link SequenceRepositoryImpl} instead.
 */
@Slf4j
@Repository
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "false", matchIfMissing = true)
public class DefaultSequenceRepository implements SequenceRepository {

    private final MongoTemplate mongoTemplate;

    @Override
    public int getNextValue(String sequenceName) {
        Query query = new Query(Criteria.where("name").is(sequenceName));
        Update update = new Update().inc("value", 1);
        FindAndModifyOptions options = FindAndModifyOptions.options()
                .returnNew(true)
                .upsert(true);
        TenantSequence result = mongoTemplate.findAndModify(
                query, update, options, TenantSequence.class);
        int value = result.getValue();
        log.debug("Sequence '{}' incremented to: {}", sequenceName, value);
        return value;
    }
}
