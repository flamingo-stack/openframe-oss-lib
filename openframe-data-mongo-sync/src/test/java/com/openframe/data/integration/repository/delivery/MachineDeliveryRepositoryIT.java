package com.openframe.data.integration.repository.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.DeliveryIntegrationTestApplication;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Limit;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = DeliveryIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MachineDeliveryRepositoryIT extends BaseMongoIntegrationTest {

    private static final String ROW_ID = "TOOL_INSTALLATION:fleetmdm-agent:mach-42";
    private static final String OTHER_ROW_ID = "TOOL_INSTALLATION:fleetmdm-agent:mach-43";
    private static final String DISPATCH_ID = "d-1";
    private static final String OTHER_DISPATCH_ID = "d-2";
    private static final String PAYLOAD = "{\"delivery\":{\"dispatchId\":\"d-1\"}}";
    private static final String ERROR = "download failed";
    private static final Instant DISPATCHED_AT = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant DUE_AT = Instant.parse("2026-01-01T00:00:30Z");
    private static final Instant LATER_DUE_AT = Instant.parse("2026-01-01T00:01:00Z");
    private static final Instant NOW = Instant.parse("2026-01-01T00:02:00Z");
    private static final Instant NEXT_DUE_AT = Instant.parse("2026-01-01T00:03:00Z");
    private static final Instant EXPIRES_AT = Instant.parse("2026-01-08T00:02:00Z");
    private static final Set<DeliveryStatus> UNACKED = Set.of(DeliveryStatus.PENDING);
    private static final Set<DeliveryStatus> OPEN = Set.of(DeliveryStatus.PENDING, DeliveryStatus.ACKED);

    @Autowired
    private MachineDeliveryRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void clean() {
        mongoTemplate.dropCollection(MachineDelivery.class);
    }

    @Test
    void findDue_pendingRowsPastDue_oldestFirstWithinLimit() {
        // setup
        repository.save(pending(ROW_ID, DISPATCH_ID, LATER_DUE_AT));
        repository.save(pending(OTHER_ROW_ID, DISPATCH_ID, DUE_AT));
        repository.save(pending("TOOL_INSTALLATION:fleetmdm-agent:mach-44", DISPATCH_ID, NEXT_DUE_AT));

        // execution
        List<MachineDelivery> firstOnly = repository.findDue(DeliveryStatus.PENDING, NOW, Limit.of(1));
        List<MachineDelivery> allDue = repository.findDue(DeliveryStatus.PENDING, NOW, Limit.of(10));

        // verifications
        assertThat(firstOnly).extracting(MachineDelivery::getId).containsExactly(OTHER_ROW_ID);
        assertThat(allDue).extracting(MachineDelivery::getId).containsExactly(OTHER_ROW_ID, ROW_ID);
    }

    @Test
    void markAcked_unackedRowOfThisDispatch_ackedOnceOnly() {
        // setup
        repository.save(pending(ROW_ID, DISPATCH_ID, DUE_AT));

        // execution
        long acked = repository.markAcked(ROW_ID, DISPATCH_ID, UNACKED, NOW, NEXT_DUE_AT);
        long ackedAgain = repository.markAcked(ROW_ID, DISPATCH_ID, UNACKED, NOW, NEXT_DUE_AT);
        long otherDispatch = repository.markAcked(ROW_ID, OTHER_DISPATCH_ID, OPEN, NOW, NEXT_DUE_AT);

        // verifications
        assertThat(acked).isEqualTo(1);
        assertThat(ackedAgain).isZero();
        assertThat(otherDispatch).isZero();
        MachineDelivery row = row(ROW_ID);
        assertThat(row.getStatus()).isEqualTo(DeliveryStatus.ACKED);
        assertThat(row.getAckedAt()).isEqualTo(NOW);
        assertThat(row.getDueAt()).isEqualTo(NEXT_DUE_AT);
        assertThat(row.getPayloadJson()).isEqualTo(PAYLOAD);
    }

    @Test
    void markRepublished_sameAttemptStillPending_attemptCountedOnceOnly() {
        // setup
        repository.save(pending(ROW_ID, DISPATCH_ID, DUE_AT));

        // execution
        long counted = repository.markRepublished(ROW_ID, UNACKED, DISPATCHED_AT, 0, NEXT_DUE_AT);
        long countedAgain = repository.markRepublished(ROW_ID, UNACKED, DISPATCHED_AT, 0, NEXT_DUE_AT);

        // verifications
        assertThat(counted).isEqualTo(1);
        assertThat(countedAgain).isZero();
        MachineDelivery row = row(ROW_ID);
        assertThat(row.getAttempts()).isEqualTo(1);
        assertThat(row.getDueAt()).isEqualTo(NEXT_DUE_AT);
    }

    @Test
    void postponeAfterError_pendingRow_errorCountedDueMoved() {
        // setup
        repository.save(pending(ROW_ID, DISPATCH_ID, DUE_AT));

        // execution
        long postponed = repository.postponeAfterError(ROW_ID, UNACKED, DISPATCHED_AT, NEXT_DUE_AT);

        // verifications
        assertThat(postponed).isEqualTo(1);
        MachineDelivery row = row(ROW_ID);
        assertThat(row.getErrors()).isEqualTo(1);
        assertThat(row.getAttempts()).isZero();
        assertThat(row.getDueAt()).isEqualTo(NEXT_DUE_AT);
    }

    @Test
    void markFailed_bySweep_failureAndExpiryWrittenPayloadDropped() {
        // setup
        repository.save(pending(ROW_ID, DISPATCH_ID, DUE_AT));

        // execution
        long failed = repository.markFailed(ROW_ID, UNACKED, DISPATCHED_AT, DeliveryFailure.EXHAUSTED, NOW, EXPIRES_AT);

        // verifications
        assertThat(failed).isEqualTo(1);
        MachineDelivery row = row(ROW_ID);
        assertThat(row.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(row.getFailure()).isEqualTo(DeliveryFailure.EXHAUSTED);
        assertThat(row.getFinishedAt()).isEqualTo(NOW);
        assertThat(row.getExpiresAt()).isEqualTo(EXPIRES_AT);
        assertThat(row.getPayloadJson()).isNull();
    }

    @Test
    void markFailed_byAgent_errorWrittenOnlyForTheOpenRowOfThisDispatch() {
        // setup
        repository.save(pending(ROW_ID, DISPATCH_ID, DUE_AT));

        // execution
        long otherDispatch = repository.markFailed(ROW_ID, OTHER_DISPATCH_ID, OPEN, DeliveryFailure.AGENT_ERROR, ERROR, NOW, EXPIRES_AT);
        long failed = repository.markFailed(ROW_ID, DISPATCH_ID, OPEN, DeliveryFailure.AGENT_ERROR, ERROR, NOW, EXPIRES_AT);

        // verifications
        assertThat(otherDispatch).isZero();
        assertThat(failed).isEqualTo(1);
        MachineDelivery row = row(ROW_ID);
        assertThat(row.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(row.getFailure()).isEqualTo(DeliveryFailure.AGENT_ERROR);
        assertThat(row.getError()).isEqualTo(ERROR);
        assertThat(row.getPayloadJson()).isNull();
    }

    @Test
    void markDoneAndCancelled_closeTheRowAndDropThePayload() {
        // setup
        repository.save(pending(ROW_ID, DISPATCH_ID, DUE_AT));
        repository.save(pending(OTHER_ROW_ID, DISPATCH_ID, DUE_AT));

        // execution
        long done = repository.markDone(ROW_ID, DISPATCH_ID, OPEN, NOW, EXPIRES_AT);
        long cancelled = repository.markCancelled(OTHER_ROW_ID, UNACKED, DISPATCHED_AT, NOW, EXPIRES_AT);

        // verifications
        assertThat(done).isEqualTo(1);
        assertThat(cancelled).isEqualTo(1);
        assertThat(row(ROW_ID).getStatus()).isEqualTo(DeliveryStatus.DONE);
        assertThat(row(ROW_ID).getPayloadJson()).isNull();
        assertThat(row(OTHER_ROW_ID).getStatus()).isEqualTo(DeliveryStatus.CANCELLED);
        assertThat(row(OTHER_ROW_ID).getFinishedAt()).isEqualTo(NOW);
    }

    @Test
    void save_newDispatchOverAClosedRow_closingFieldsGone() {
        // setup
        repository.save(pending(ROW_ID, DISPATCH_ID, DUE_AT));
        repository.markAcked(ROW_ID, DISPATCH_ID, UNACKED, NOW, NEXT_DUE_AT);
        repository.markFailed(ROW_ID, DISPATCH_ID, OPEN, DeliveryFailure.AGENT_ERROR, ERROR, NOW, EXPIRES_AT);

        // execution
        repository.save(pending(ROW_ID, OTHER_DISPATCH_ID, LATER_DUE_AT));

        // verifications
        MachineDelivery row = row(ROW_ID);
        assertThat(row.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(row.getDispatchId()).isEqualTo(OTHER_DISPATCH_ID);
        assertThat(row.getPayloadJson()).isEqualTo(PAYLOAD);
        assertThat(row.getAckedAt()).isNull();
        assertThat(row.getFinishedAt()).isNull();
        assertThat(row.getFailure()).isNull();
        assertThat(row.getError()).isNull();
    }

    private MachineDelivery row(String id) {
        return repository.findById(id).orElseThrow();
    }

    private static MachineDelivery pending(String id, String dispatchId, Instant dueAt) {
        return MachineDelivery.builder()
                .id(id)
                .type(DeliveryType.TOOL_INSTALLATION)
                .targetId("fleetmdm-agent")
                .machineId(id.substring(id.lastIndexOf(':') + 1))
                .tenantId("tenant-1")
                .dispatchId(dispatchId)
                .status(DeliveryStatus.PENDING)
                .attempts(0)
                .errors(0)
                .payloadJson(PAYLOAD)
                .dispatchedAt(DISPATCHED_AT)
                .dueAt(dueAt)
                .expiresAt(EXPIRES_AT)
                .build();
    }
}
