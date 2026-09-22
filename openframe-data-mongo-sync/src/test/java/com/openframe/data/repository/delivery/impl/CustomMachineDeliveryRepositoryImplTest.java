package com.openframe.data.repository.delivery.impl;

import com.mongodb.ReadPreference;
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
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomMachineDeliveryRepositoryImplTest {

    private static final String ID = "TOOL_INSTALLATION:fleetmdm-agent:mach-42";
    private static final String MACHINE_ID = "mach-42";
    private static final String TENANT_ID = "tenant-1";
    private static final int LIMIT = 500;
    private static final int ATTEMPTS = 1;

    @Mock private TenantAwareMongoTemplate mongoTemplate;
    @Mock private MongoConverter converter;

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
    void findDue_statusAndDeadline_readsPrimaryOldestFirstWithLimit() {
        // setup
        when(mongoTemplate.find(queryCaptor.capture(), eq(MachineDelivery.class))).thenReturn(List.of());

        // execution
        repository.findDue(DeliveryStatus.PENDING, now, LIMIT);

        // verifications
        Query query = queryCaptor.getValue();
        assertThat(query.getReadPreference()).isEqualTo(ReadPreference.primary());
        assertThat(query.getLimit()).isEqualTo(LIMIT);
        assertThat(query.getQueryObject().toString()).contains("PENDING").contains("$lt");
        assertThat(query.getSortObject().toString()).contains("dueAt");
    }

    @Test
    void upsertPending_row_setsEveryFieldAndTenantWithinScopedUpsert() {
        // setup
        MachineDelivery delivery = MachineDelivery.builder().id(ID).machineId(MACHINE_ID).build();
        when(mongoTemplate.getConverter()).thenReturn(converter);
        when(mongoTemplate.tenantId()).thenReturn(TENANT_ID);

        // execution
        repository.upsertPending(delivery);

        // verifications
        verify(mongoTemplate).upsert(queryCaptor.capture(), updateCaptor.capture(), eq(MachineDelivery.class));
        assertThat(queryCaptor.getValue().getQueryObject().toString()).contains(ID);
        assertThat(updateCaptor.getValue().getUpdateObject().toString())
                .contains("$set")
                .contains("tenantId=" + TENANT_ID);
    }

    @Test
    void markRepublished_sameDispatchAndAttemptStillPending_attemptCountedAndTrue() {
        // setup
        UpdateResult oneRow = UpdateResult.acknowledged(1, 1L, null);
        when(mongoTemplate.updateFirst(queryCaptor.capture(), updateCaptor.capture(), eq(MachineDelivery.class))).thenReturn(oneRow);

        // execution
        boolean republished = repository.markRepublished(ID, DeliveryStatus.UNACKED, now, ATTEMPTS, now);

        // verifications
        assertThat(republished).isTrue();
        assertThat(queryCaptor.getValue().getQueryObject().toString())
                .contains(ID)
                .contains("PENDING")
                .contains("dispatchedAt")
                .contains("attempts=" + ATTEMPTS)
                .doesNotContain("ACKED");
        assertThat(updateCaptor.getValue().getUpdateObject().toString())
                .contains("$inc")
                .contains("dueAt");
    }

    @Test
    void markRepublished_rowMovedOn_false() {
        // setup
        UpdateResult noRow = UpdateResult.acknowledged(0, 0L, null);
        when(mongoTemplate.updateFirst(queryCaptor.capture(), updateCaptor.capture(), eq(MachineDelivery.class))).thenReturn(noRow);

        // execution
        boolean republished = repository.markRepublished(ID, DeliveryStatus.UNACKED, now, ATTEMPTS, now);

        // verifications
        assertThat(republished).isFalse();
    }

    @Test
    void postponeAfterError_pendingRow_errorCountedAndDueMoved() {
        // setup
        UpdateResult oneRow = UpdateResult.acknowledged(1, 1L, null);
        when(mongoTemplate.updateFirst(queryCaptor.capture(), updateCaptor.capture(), eq(MachineDelivery.class))).thenReturn(oneRow);

        // execution
        boolean postponed = repository.postponeAfterError(ID, DeliveryStatus.UNACKED, now, now);

        // verifications
        assertThat(postponed).isTrue();
        assertThat(updateCaptor.getValue().getUpdateObject().toString())
                .contains("errors=1")
                .contains("dueAt");
    }

    @Test
    void markFailed_openRowSameDispatch_failureAndExpiryWrittenPayloadDropped() {
        // setup
        UpdateResult oneRow = UpdateResult.acknowledged(1, 1L, null);
        when(mongoTemplate.updateFirst(queryCaptor.capture(), updateCaptor.capture(), eq(MachineDelivery.class))).thenReturn(oneRow);

        // execution
        boolean failed = repository.markFailed(ID, DeliveryStatus.OPEN, now, DeliveryFailure.TIMEOUT, now, now);

        // verifications
        assertThat(failed).isTrue();
        assertThat(queryCaptor.getValue().getQueryObject().toString())
                .contains("PENDING")
                .contains("ACKED")
                .contains("dispatchedAt");
        assertThat(updateCaptor.getValue().getUpdateObject().toString())
                .contains("FAILED")
                .contains("TIMEOUT")
                .contains("expiresAt")
                .contains("$unset")
                .contains("payloadJson");
    }

    @Test
    void wake_parkedRowsOfMachine_unparkedAndModifiedCountReturned() {
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
                .contains("parked=true");
        assertThat(updateCaptor.getValue().getUpdateObject().toString())
                .contains("parked=false")
                .contains("dueAt");
    }
}
