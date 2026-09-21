package com.openframe.delivery.dispatch;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryOfflineBehavior;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryTestPolicies;
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
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class MongoDeliveryRecorderTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String VALUE = "issued";

    @Mock private MachineDeliveryRepository repository;

    @Captor private ArgumentCaptor<MachineDelivery> deliveryCaptor;

    private MongoDeliveryRecorder recorder;

    private DeliveryRequest<TestPayload> request;

    @BeforeEach
    void setUp() {
        TestPayload payload = new TestPayload();
        payload.setValue(VALUE);
        request = DeliveryRequest.<TestPayload>builder()
                .type(DeliveryType.CLIENT_UNINSTALL)
                .targetId(MACHINE_ID)
                .machineId(MACHINE_ID)
                .payload(payload)
                .offlineBehavior(DeliveryOfflineBehavior.RETRY_ON_RECONNECT)
                .build();
        recorder = new MongoDeliveryRecorder(repository, DeliveryTestPolicies.properties(), new ObjectMapper());
    }

    @Test
    void record_request_pendingRowSavedDueAfterAckThreshold() {
        // setup

        // execution
        recorder.record(request);

        // verifications
        verify(repository).save(deliveryCaptor.capture());
        MachineDelivery saved = deliveryCaptor.getValue();
        assertThat(saved.getId()).isEqualTo("CLIENT_UNINSTALL:mach-42:mach-42");
        assertThat(saved.getType()).isEqualTo(DeliveryType.CLIENT_UNINSTALL);
        assertThat(saved.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(saved.getAttempts()).isZero();
        assertThat(saved.getPayloadJson()).contains(VALUE);
        assertThat(saved.getOfflineBehavior()).isEqualTo(DeliveryOfflineBehavior.RETRY_ON_RECONNECT);
        assertThat(saved.getDispatchedAt()).isEqualTo(saved.getLastAttemptAt());
        assertThat(saved.getDueAt()).isEqualTo(saved.getDispatchedAt().plusSeconds(ACK_THRESHOLD));
    }
}
