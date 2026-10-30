package com.openframe.delivery.dispatch;

import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.data.repository.delivery.PayloadReplacement;
import com.openframe.delivery.spec.TestPayload;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryRefresherTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TARGET_ID = "exec-1";
    private static final String ROW_ID = "SCRIPT_SCHEDULE:exec-1:mach-42";
    private static final String DISPATCH_ID = "d-1";
    private static final String PAYLOAD_ID = "tenant-1:SCRIPT_SCHEDULE:abc";
    private static final long CLOCK_SLACK_SECONDS = 5L;

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliveryPayloadStore payloads;
    @Captor private ArgumentCaptor<PayloadReplacement> replacementCaptor;
    @Captor private ArgumentCaptor<Instant> expiresAtCaptor;

    private DeliveryRefresher refresher;
    private TestPayload payload;
    private Instant rowExpiresAt;

    @BeforeEach
    void setUp() {
        payload = new TestPayload();
        payload.setValue("echo b");
        rowExpiresAt = Instant.now().plusSeconds(3_600);
        refresher = new DeliveryRefresher(repository, payloads, new DeliveryPayloadJson(new JsonMapper()));
    }

    @Test
    void refresh_unackedRow_newBodyHeldAsLongAsTheRowAndTheRowTakesItUnderANewDispatch() {
        // setup
        Instant before = Instant.now();
        when(repository.findByIdOnPrimary(ROW_ID)).thenReturn(Optional.of(row(DeliveryStatus.PENDING)));
        when(payloads.hold(eq(DeliveryType.SCRIPT_SCHEDULE), any(DeliveryPayloadBody.class), expiresAtCaptor.capture())).thenReturn(PAYLOAD_ID);
        when(repository.replacePayload(replacementCaptor.capture())).thenReturn(true);

        // execution
        boolean replaced = refresher.refresh(DeliveryType.SCRIPT_SCHEDULE, TARGET_ID, MACHINE_ID, payload);

        // verifications
        assertThat(replaced).isTrue();
        assertThat(expiresAtCaptor.getValue()).isEqualTo(rowExpiresAt.plusSeconds(DeliveryRecorder.BODY_OUTLIVES_ROW_SECONDS));
        PayloadReplacement replacement = replacementCaptor.getValue();
        assertThat(replacement.getId()).isEqualTo(ROW_ID);
        assertThat(replacement.getFrom()).isEqualTo(DeliveryStatus.UNACKED);
        assertThat(replacement.getDispatchId()).isEqualTo(DISPATCH_ID);
        assertThat(replacement.getPayloadId()).isEqualTo(PAYLOAD_ID);
        assertThat(replacement.getNextDispatchId()).isNotBlank().isNotEqualTo(DISPATCH_ID);
        assertThat(replacement.getDueAt())
                .isAfterOrEqualTo(before)
                .isBefore(before.plusSeconds(CLOCK_SLACK_SECONDS));
    }

    @Test
    void refresh_rowAlreadyAcked_bodyKept() {
        // setup
        when(repository.findByIdOnPrimary(ROW_ID)).thenReturn(Optional.of(row(DeliveryStatus.ACKED)));

        // execution
        boolean replaced = refresher.refresh(DeliveryType.SCRIPT_SCHEDULE, TARGET_ID, MACHINE_ID, payload);

        // verifications
        assertThat(replaced).isFalse();
        verify(payloads, never()).hold(any(), any(), any());
        verify(repository, never()).replacePayload(any());
    }

    @Test
    void refresh_noRow_nothingHeld() {
        // setup
        when(repository.findByIdOnPrimary(ROW_ID)).thenReturn(Optional.empty());

        // execution
        boolean replaced = refresher.refresh(DeliveryType.SCRIPT_SCHEDULE, TARGET_ID, MACHINE_ID, payload);

        // verifications
        assertThat(replaced).isFalse();
        verify(payloads, never()).hold(any(), any(), any());
    }

    private MachineDelivery row(DeliveryStatus status) {
        return MachineDelivery.builder()
                .id(ROW_ID)
                .type(DeliveryType.SCRIPT_SCHEDULE)
                .targetId(TARGET_ID)
                .machineId(MACHINE_ID)
                .status(status)
                .dispatchId(DISPATCH_ID)
                .expiresAt(rowExpiresAt)
                .build();
    }
}
