package com.openframe.data.repository.delivery.impl;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomMachineDeliveryRepositoryImplTest {

    private static final String ID = "TOOL_INSTALLATION:fleetmdm-agent:mach-42";
    private static final String MACHINE_ID = "mach-42";

    @Mock private TenantAwareMongoTemplate mongoTemplate;

    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Update> updateCaptor;

    private CustomMachineDeliveryRepositoryImpl repository;

    private Instant now;

    @BeforeEach
    void setUp() {
        now = Instant.now();
        repository = new CustomMachineDeliveryRepositoryImpl(mongoTemplate);
    }

    @Test
    void markRepublished_rowStillPending_attemptCountedAndTrue() {
        // setup
        UpdateResult oneRow = UpdateResult.acknowledged(1, 1L, null);
        when(mongoTemplate.updateFirst(queryCaptor.capture(), updateCaptor.capture(), eq(MachineDelivery.class))).thenReturn(oneRow);

        // execution
        boolean republished = repository.markRepublished(ID, DeliveryStatus.UNACKED, now, now);

        // verifications
        assertThat(republished).isTrue();
        assertThat(queryCaptor.getValue().getQueryObject().toString())
                .contains(ID)
                .contains("PENDING")
                .doesNotContain("ACKED");
        assertThat(updateCaptor.getValue().getUpdateObject().toString())
                .contains("$inc")
                .contains("dueAt");
    }

    @Test
    void markRepublished_rowAckedMeanwhile_false() {
        // setup
        UpdateResult noRow = UpdateResult.acknowledged(0, 0L, null);
        when(mongoTemplate.updateFirst(queryCaptor.capture(), updateCaptor.capture(), eq(MachineDelivery.class))).thenReturn(noRow);

        // execution
        boolean republished = repository.markRepublished(ID, DeliveryStatus.UNACKED, now, now);

        // verifications
        assertThat(republished).isFalse();
    }

    @Test
    void markFailed_openRow_failureAndExpiryWritten() {
        // setup
        UpdateResult oneRow = UpdateResult.acknowledged(1, 1L, null);
        when(mongoTemplate.updateFirst(queryCaptor.capture(), updateCaptor.capture(), eq(MachineDelivery.class))).thenReturn(oneRow);

        // execution
        boolean failed = repository.markFailed(ID, DeliveryStatus.OPEN, DeliveryFailure.TIMEOUT, now, now);

        // verifications
        assertThat(failed).isTrue();
        assertThat(queryCaptor.getValue().getQueryObject().toString())
                .contains("PENDING")
                .contains("ACKED");
        assertThat(updateCaptor.getValue().getUpdateObject().toString())
                .contains("FAILED")
                .contains("TIMEOUT")
                .contains("expiresAt");
    }

    @Test
    void wake_parkedRowsForMachine_modifiedCountReturned() {
        // setup
        UpdateResult twoRows = UpdateResult.acknowledged(2, 2L, null);
        when(mongoTemplate.updateMulti(queryCaptor.capture(), updateCaptor.capture(), eq(MachineDelivery.class))).thenReturn(twoRows);

        // execution
        long woken = repository.wake(MACHINE_ID, DeliveryStatus.UNACKED, now);

        // verifications
        assertThat(woken).isEqualTo(2);
        assertThat(queryCaptor.getValue().getQueryObject().toString())
                .contains(MACHINE_ID)
                .contains("PENDING")
                .contains("$gt");
    }
}
