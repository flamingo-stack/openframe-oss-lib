package com.openframe.data.repository.delivery.impl;

import com.mongodb.ReadPreference;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDeliveryPayload;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineDeliveryPayloadRepositoryImplTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String HASH = "abc123";
    private static final String ID = "tenant-1:TOOL_INSTALLATION:abc123";
    private static final String PAYLOAD_JSON = "{\"value\":\"fleetmdm-agent\"}";

    @Mock private TenantAwareMongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Update> updateCaptor;

    private MachineDeliveryPayloadRepositoryImpl repository;
    private Instant expiresAt;

    @BeforeEach
    void setUp() {
        expiresAt = Instant.now().plusSeconds(3600);
        repository = new MachineDeliveryPayloadRepositoryImpl(mongoTemplate);
    }

    @Test
    void hold_body_writtenOnceUnderTheTenantsContentIdAndItsExpiryOnlyMovesForward() {
        // setup
        when(mongoTemplate.tenantId()).thenReturn(TENANT_ID);

        // execution
        String id = repository.hold(DeliveryType.TOOL_INSTALLATION, HASH, PAYLOAD_JSON, expiresAt);

        // verifications
        assertThat(id).isEqualTo(ID);
        verify(mongoTemplate).upsert(queryCaptor.capture(), updateCaptor.capture(), eq(MachineDeliveryPayload.class));
        assertThat(queryCaptor.getValue().getQueryObject()).isEqualTo(new Document("_id", ID));
        Document update = updateCaptor.getValue().getUpdateObject();
        Document onInsert = update.get("$setOnInsert", Document.class);
        assertThat(onInsert.get("tenantId")).isEqualTo(TENANT_ID);
        assertThat(onInsert.get("type")).isEqualTo(DeliveryType.TOOL_INSTALLATION);
        assertThat(onInsert.get("payloadJson")).isEqualTo(PAYLOAD_JSON);
        assertThat(update.get("$max", Document.class).get("expiresAt")).isEqualTo(expiresAt);
        assertThat(update).doesNotContainKey("$set");
    }

    @Test
    void hold_insertedByAnotherPodAMomentAgo_secondPassMovesTheExpiry() {
        // setup
        when(mongoTemplate.tenantId()).thenReturn(TENANT_ID);
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(MachineDeliveryPayload.class)))
                .thenThrow(new DuplicateKeyException("raced"))
                .thenReturn(null);

        // execution
        String id = repository.hold(DeliveryType.TOOL_INSTALLATION, HASH, PAYLOAD_JSON, expiresAt);

        // verifications
        assertThat(id).isEqualTo(ID);
        verify(mongoTemplate, times(2)).upsert(any(Query.class), any(Update.class), eq(MachineDeliveryPayload.class));
    }

    @Test
    void findJsonOnPrimary_body_readFromThePrimary() {
        // setup
        MachineDeliveryPayload body = new MachineDeliveryPayload();
        body.setPayloadJson(PAYLOAD_JSON);
        when(mongoTemplate.findOne(queryCaptor.capture(), eq(MachineDeliveryPayload.class))).thenReturn(body);

        // execution
        Optional<String> json = repository.findJsonOnPrimary(ID);

        // verifications
        assertThat(json).contains(PAYLOAD_JSON);
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject()).isEqualTo(new Document("_id", ID));
        assertThat(query.getReadPreference()).isEqualTo(ReadPreference.primary());
    }

    @Test
    void findJsonOnPrimary_expiredBody_empty() {
        // setup
        when(mongoTemplate.findOne(any(Query.class), eq(MachineDeliveryPayload.class))).thenReturn(null);

        // execution + verifications
        assertThat(repository.findJsonOnPrimary(ID)).isEmpty();
    }
}
