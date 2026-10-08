package com.openframe.delivery.rollout;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryRolloutStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDeliveryRollout;
import com.openframe.data.repository.delivery.MachineDeliveryRolloutRepository;
import com.openframe.data.repository.delivery.MachineDeliverySequenceRepository;
import com.openframe.delivery.dispatch.DeliveryPayloadJson;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import com.openframe.delivery.spec.TestPayload;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryRolloutRecorderTest {

    private static final String TARGET_ID = "openframe-client";
    private static final int SEQUENCE = 7;

    @Mock private MachineDeliveryRolloutRepository repository;
    @Mock private MachineDeliverySequenceRepository sequences;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliverySpec<DeliverySeed, DeliveryPayload> spec;

    @Captor private ArgumentCaptor<MachineDeliveryRollout> rolloutCaptor;

    private DeliveryRolloutRecorder recorder;
    private DeliveryRequest<TestPayload> request;

    @BeforeEach
    void setUp() {
        recorder = new DeliveryRolloutRecorder(repository, sequences, registry, new DeliveryPayloadJson(new ObjectMapper()));
        TestPayload payload = new TestPayload();
        payload.setValue("1.5.11");
        payload.setDelivery(new DeliveryRef(DeliveryType.CLIENT_UPDATE, TARGET_ID, "d-rollout"));
        request = DeliveryRequest.<TestPayload>builder()
                .type(DeliveryType.CLIENT_UPDATE)
                .targetId(TARGET_ID)
                .machineId(DeliveryRequest.EVERY_MACHINE)
                .payload(payload)
                .build();
        doReturn(spec).when(registry).require(DeliveryType.CLIENT_UPDATE);
    }

    @Test
    void record_requestForEveryMachine_rolloutSavedAtTheStartWithOneSequence() {
        // setup
        when(spec.canDeliverToEveryMachine()).thenReturn(true);
        when(sequences.next()).thenReturn(SEQUENCE);

        // execution
        recorder.record(request);

        // verifications
        verify(repository).save(rolloutCaptor.capture());
        MachineDeliveryRollout rollout = rolloutCaptor.getValue();
        assertThat(rollout.getId()).isEqualTo("CLIENT_UPDATE:openframe-client");
        assertThat(rollout.getType()).isEqualTo(DeliveryType.CLIENT_UPDATE);
        assertThat(rollout.getTargetId()).isEqualTo(TARGET_ID);
        assertThat(rollout.getSequence()).isEqualTo(SEQUENCE);
        assertThat(rollout.getStatus()).isEqualTo(DeliveryRolloutStatus.RUNNING);
        assertThat(rollout.getCursor()).isEmpty();
        assertThat(rollout.getDispatched()).isZero();
        assertThat(rollout.getStartedAt()).isNotNull();
        assertThat(rollout.getPayloadJson()).contains("1.5.11");
    }

    @Test
    void record_typeThatDeliversToOneMachineAtATime_rejectedNothingSaved() {
        // setup
        when(spec.canDeliverToEveryMachine()).thenReturn(false);

        // execution + verifications
        assertThatThrownBy(() -> recorder.record(request)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository, sequences);
    }
}
