package com.openframe.data.repository.delivery.impl;

import com.mongodb.ReadPreference;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDeliveryPayload;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.TenantAwareRepositorySupport;
import com.openframe.data.repository.delivery.MachineDeliveryPayloadRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class MachineDeliveryPayloadRepositoryImpl extends TenantAwareRepositorySupport
        implements MachineDeliveryPayloadRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_TYPE = "type";
    private static final String FIELD_PAYLOAD_JSON = "payloadJson";
    private static final String FIELD_EXPIRES_AT = "expiresAt";
    private static final String SEPARATOR = ":";

    public MachineDeliveryPayloadRepositoryImpl(TenantAwareMongoTemplate mongoTemplate) {
        super(mongoTemplate);
    }

    // the body is written once and only its expiry moves, forward: a row pointing at it never outlives it
    @Override
    public String hold(DeliveryType type, String hash, String payloadJson, Instant expiresAt) {
        String tenantId = tenantId();
        String id = tenantId + SEPARATOR + type.name() + SEPARATOR + hash;
        Query byId = new Query(Criteria.where(FIELD_ID).is(id));
        Update update = new Update()
                .setOnInsert(FIELD_TENANT_ID, tenantId)
                .setOnInsert(FIELD_TYPE, type)
                .setOnInsert(FIELD_PAYLOAD_JSON, payloadJson)
                .max(FIELD_EXPIRES_AT, expiresAt);
        try {
            mongoTemplate.upsert(byId, update, MachineDeliveryPayload.class);
        } catch (DuplicateKeyException insertedAMomentAgo) {
            // two pods held the same body at once: the second pass finds the document and only moves its expiry
            mongoTemplate.upsert(byId, update, MachineDeliveryPayload.class);
        }
        return id;
    }

    // primary on purpose: the sweep reads a body milliseconds after another pod wrote it
    @Override
    public Optional<String> findJsonOnPrimary(String id) {
        Query query = new Query(Criteria.where(FIELD_ID).is(id)).withReadPreference(ReadPreference.primary());
        MachineDeliveryPayload body = mongoTemplate.findOne(query, MachineDeliveryPayload.class);
        return Optional.ofNullable(body).map(MachineDeliveryPayload::getPayloadJson);
    }
}
