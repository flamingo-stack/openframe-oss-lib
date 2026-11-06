package com.openframe.data.repository.device;

import com.openframe.data.document.device.Machine;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CustomMachineRepositoryHostFactsCheckedTest {

    private static final String MACHINE_ID = "m-1";
    private static final Instant CHECKED_AT = Instant.parse("2026-10-30T03:15:00Z");

    @Mock private MongoTemplate mongoTemplate;

    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Update> updateCaptor;

    @InjectMocks private CustomMachineRepositoryImpl repository;

    @Test
    void markHostFactsChecked_knownMachine_stampsTheMarkerAndHoldsTheVersion() {
        // setup

        // execution
        repository.markHostFactsChecked(MACHINE_ID, CHECKED_AT);

        // verifications
        verify(mongoTemplate).updateFirst(queryCaptor.capture(), updateCaptor.capture(), eq(Machine.class));
        assertThat(queryCaptor.getValue().getQueryObject()).containsEntry("machineId", MACHINE_ID);
        Document update = updateCaptor.getValue().getUpdateObject();
        assertThat(update.get("$set", Document.class)).containsEntry("hostFactsCheckedAt", CHECKED_AT);
        assertThat(update.get("$inc", Document.class)).containsEntry("version", 0);
    }
}
