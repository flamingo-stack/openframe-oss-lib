package com.openframe.delivery;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecordingDeliveryDispatchTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String VALUE = "issued";

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliverySpec<TestPayload> spec;

    @Captor private ArgumentCaptor<MachineDelivery> deliveryCaptor;

    private RecordingDeliveryDispatch dispatch;

    private TestPayload payload;

    @BeforeEach
    void setUp() {
        payload = new TestPayload();
        payload.setValue(VALUE);
        dispatch = new RecordingDeliveryDispatch(repository, new ObjectMapper());
    }

    @Test
    void send_request_pendingRowSavedThenPublishedThroughSpec() {
        // setup
        when(spec.getType()).thenReturn(DeliveryType.CLIENT_UNINSTALL);
        DeliveryRequest<TestPayload> request = DeliveryRequest.<TestPayload>builder()
                .spec(spec)
                .targetId(MACHINE_ID)
                .machineId(MACHINE_ID)
                .payload(payload)
                .offlineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT)
                .build();

        // execution
        dispatch.send(request);

        // verifications
        verify(repository).save(deliveryCaptor.capture());
        MachineDelivery saved = deliveryCaptor.getValue();
        assertThat(saved.getId()).isEqualTo("CLIENT_UNINSTALL:mach-42:mach-42");
        assertThat(saved.getType()).isEqualTo(DeliveryType.CLIENT_UNINSTALL);
        assertThat(saved.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(saved.getAttempts()).isZero();
        assertThat(saved.getPayloadJson()).contains(VALUE);
        assertThat(saved.getOfflineBehavior()).isEqualTo(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        assertThat(saved.getDispatchedAt()).isEqualTo(saved.getLastAttemptAt());
        verify(spec).publish(MACHINE_ID, payload);
    }
}
