package com.openframe.delivery.dispatch;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.data.repository.sequence.SequenceRepository;
import com.openframe.delivery.config.DeliveryTestPolicies;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.TestPayload;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static com.openframe.delivery.config.DeliveryTestPolicies.ACK_THRESHOLD;
import static com.openframe.delivery.config.DeliveryTestPolicies.TTL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryRecorderTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String VALUE = "issued";
    private static final String DISPATCH_ID = "d-1";
    private static final String ROW_ID = "CLIENT_UNINSTALL:mach-42:mach-42";
    private static final int SEQUENCE = 7;

    @Mock private MachineDeliveryRepository repository;
    @Mock private SequenceRepository sequences;

    @Captor private ArgumentCaptor<MachineDelivery> deliveryCaptor;

    private DeliveryRecorder recorder;

    private TestPayload payload;
    private DeliveryRequest<TestPayload> request;

    @BeforeEach
    void setUp() {
        payload = new TestPayload();
        payload.setValue(VALUE);
        payload.setDelivery(new DeliveryRef(DeliveryType.CLIENT_UNINSTALL, MACHINE_ID, DISPATCH_ID));
        request = DeliveryRequest.<TestPayload>builder()
                .type(DeliveryType.CLIENT_UNINSTALL)
                .targetId(MACHINE_ID)
                .machineId(MACHINE_ID)
                .payload(payload)
                .build();
        recorder = new DeliveryRecorder(repository, sequences, DeliveryTestPolicies.properties(), new ObjectMapper());
    }

    @Test
    void record_rowOfThisDispatchAlreadyThere_falseAndNoSequenceConsumed() {
        // setup
        when(repository.existsByIdAndDispatchId(any(), any())).thenReturn(true);

        // execution
        boolean recorded = recorder.record(request);

        // verifications
        assertThat(recorded).isFalse();
        verify(repository, never()).save(any(MachineDelivery.class));
        verifyNoInteractions(sequences);
    }

    @Test
    void record_request_pendingRowUpsertedDueAfterAckThreshold() {
        // setup
        when(sequences.getNextValue("delivery." + ROW_ID)).thenReturn(SEQUENCE);

        // execution
        recorder.record(request);

        // verifications
        verify(repository).save(deliveryCaptor.capture());
        MachineDelivery saved = deliveryCaptor.getValue();
        assertThat(saved.getId()).isEqualTo(ROW_ID);
        assertThat(saved.getType()).isEqualTo(DeliveryType.CLIENT_UNINSTALL);
        assertThat(saved.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(saved.getAttempts()).isZero();
        assertThat(saved.getDispatchId()).isEqualTo(DISPATCH_ID);
        assertThat(saved.getPayloadJson()).contains(VALUE).contains(DISPATCH_ID);
        assertThat(saved.getDueAt()).isEqualTo(saved.getDispatchedAt().plusSeconds(ACK_THRESHOLD));
        assertThat(saved.getExpiresAt()).isEqualTo(saved.getDispatchedAt().plusSeconds(TTL));
        assertThat(saved.getErrors()).isZero();
    }

    @Test
    void record_request_sequenceStampedIntoThePayloadBeforeItIsStored() {
        // setup
        when(sequences.getNextValue("delivery." + ROW_ID)).thenReturn(SEQUENCE);

        // execution
        recorder.record(request);

        // verifications
        assertThat(payload.getDelivery().getSequence()).isEqualTo(SEQUENCE);
        verify(repository).save(deliveryCaptor.capture());
        MachineDelivery saved = deliveryCaptor.getValue();
        assertThat(saved.getPayloadJson()).contains("\"sequence\":7");
    }
}
