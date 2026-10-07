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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomMachineDeliverySequenceRepositoryImplTest {

    private static final String ROW_ID = "CLIENT_UPDATE:openframe-client:mach-42";
    private static final String MACHINE_ID = "mach-42";

    @Mock private TenantAwareMongoTemplate mongoTemplate;

    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Update> updateCaptor;
    @Captor private ArgumentCaptor<FindAndModifyOptions> optionsCaptor;

    private CustomMachineDeliverySequenceRepositoryImpl repository;

    @BeforeEach
    void setUp() {
        repository = new CustomMachineDeliverySequenceRepositoryImpl(mongoTemplate);
    }

    @Test
    void next_rowKey_incrementsOneDocumentCreatingItOnFirstUseAndReturnsTheNewValue() {
        // setup
        MachineDeliverySequence incremented = new MachineDeliverySequence();
        incremented.setValue(7);
        when(mongoTemplate.findAndModify(queryCaptor.capture(), updateCaptor.capture(), optionsCaptor.capture(), eq(MachineDeliverySequence.class)))
                .thenReturn(incremented);

        // execution
        int next = repository.next(ROW_ID, MACHINE_ID);

        // verifications
        assertThat(next).isEqualTo(7);
        assertThat(queryCaptor.getValue().getQueryObject()).isEqualTo(new Document("_id", ROW_ID));
        Document update = updateCaptor.getValue().getUpdateObject();
        assertThat(update.get("$inc", Document.class)).isEqualTo(new Document("value", 1));
        assertThat(update.get("$setOnInsert", Document.class)).isEqualTo(new Document("machineId", MACHINE_ID));
        FindAndModifyOptions options = optionsCaptor.getValue();
        assertThat(options.isUpsert()).isTrue();
        assertThat(options.isReturnNew()).isTrue();
    }
}
