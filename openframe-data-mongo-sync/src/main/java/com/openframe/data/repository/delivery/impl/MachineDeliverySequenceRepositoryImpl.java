package com.openframe.data.repository.delivery.impl;

import com.openframe.data.document.delivery.MachineDeliverySequence;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.TenantAwareRepositorySupport;
import com.openframe.data.repository.delivery.MachineDeliverySequenceRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

@Repository
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class MachineDeliverySequenceRepositoryImpl extends TenantAwareRepositorySupport
        implements MachineDeliverySequenceRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_VALUE = "value";

    private static final FindAndModifyOptions INCREMENTED = FindAndModifyOptions.options().upsert(true).returnNew(true);

    public MachineDeliverySequenceRepositoryImpl(TenantAwareMongoTemplate mongoTemplate) {
        super(mongoTemplate);
    }

    // one atomic $inc on the tenant's document: no two dispatches get the same number, the order never goes backwards
    @Override
    public int next() {
        Query byTenant = new Query(Criteria.where(FIELD_ID).is(tenantId()));
        Update increment = new Update().inc(FIELD_VALUE, 1);
        MachineDeliverySequence sequence = mongoTemplate.findAndModify(byTenant, increment, INCREMENTED, MachineDeliverySequence.class);
        return sequence.getValue();
    }
}
