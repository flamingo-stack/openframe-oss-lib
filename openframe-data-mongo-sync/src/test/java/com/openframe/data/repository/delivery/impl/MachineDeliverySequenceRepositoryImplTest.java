package com.openframe.data.repository.delivery.impl;

import com.openframe.data.document.delivery.MachineDeliverySequence;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineDeliverySequenceRepositoryImplTest {

    private static final String TENANT_ID = "tenant-1";

    @Mock private TenantAwareMongoTemplate mongoTemplate;

    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Update> updateCaptor;
    @Captor private ArgumentCaptor<FindAndModifyOptions> optionsCaptor;

    private MachineDeliverySequenceRepositoryImpl repository;

    @BeforeEach
    void setUp() {
        when(mongoTemplate.tenantId()).thenReturn(TENANT_ID);
        repository = new MachineDeliverySequenceRepositoryImpl(mongoTemplate);
    }

    @Test
    void next_tenantCounter_incrementedInPlaceCreatedOnFirstUseAndNewValueReturned() {
        // setup
        MachineDeliverySequence incremented = new MachineDeliverySequence();
        incremented.setValue(7);
        when(mongoTemplate.findAndModify(queryCaptor.capture(), updateCaptor.capture(), optionsCaptor.capture(), eq(MachineDeliverySequence.class)))
                .thenReturn(incremented);

        // execution
        int next = repository.next();

        // verifications
        assertThat(next).isEqualTo(7);
        assertThat(queryCaptor.getValue().getQueryObject()).isEqualTo(new Document("_id", TENANT_ID));
        assertThat(updateCaptor.getValue().getUpdateObject()).isEqualTo(new Document("$inc", new Document("value", 1)));
        FindAndModifyOptions options = optionsCaptor.getValue();
        assertThat(options.isUpsert()).isTrue();
        assertThat(options.isReturnNew()).isTrue();
    }
}
