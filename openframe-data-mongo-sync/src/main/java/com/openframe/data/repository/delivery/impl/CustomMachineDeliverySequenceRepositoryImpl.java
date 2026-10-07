package com.openframe.data.repository.delivery.impl;

import com.openframe.data.document.delivery.MachineDeliverySequence;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.TenantAwareRepositorySupport;
import com.openframe.data.repository.delivery.CustomMachineDeliverySequenceRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class CustomMachineDeliverySequenceRepositoryImpl extends TenantAwareRepositorySupport
        implements CustomMachineDeliverySequenceRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_VALUE = "value";

    private static final FindAndModifyOptions INCREMENTED = FindAndModifyOptions.options().upsert(true).returnNew(true);

    public CustomMachineDeliverySequenceRepositoryImpl(TenantAwareMongoTemplate mongoTemplate) {
        super(mongoTemplate);
    }

    // one atomic $inc on one document: no two pods hand out the same number, and the order never goes backwards
    @Override
    public int next(String id, String machineId) {
        Query byId = new Query(Criteria.where(FIELD_ID).is(id));
        Update increment = new Update().inc(FIELD_VALUE, 1).setOnInsert(FIELD_MACHINE_ID, machineId);
        MachineDeliverySequence sequence = mongoTemplate.findAndModify(byId, increment, INCREMENTED, MachineDeliverySequence.class);
        return sequence.getValue();
    }
}
