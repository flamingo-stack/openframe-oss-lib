package com.openframe.data.nats.delivery;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.delivery.DeliveryStatus;
import com.openframe.data.document.rmm.delivery.MachineDelivery;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.nats.model.ClientUninstallMessage;
import com.openframe.data.repository.rmm.MachineDeliveryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class DeliveryDispatchTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String ISSUED_AT = "2026-09-15T10:00:00Z";

    @Mock private MachineDeliveryRepository repository;
    @Mock private Runnable publish;

    @Captor private ArgumentCaptor<MachineDelivery> deliveryCaptor;

    private DeliveryDispatch dispatch;

    @BeforeEach
    void setUp() {
        dispatch = new DeliveryDispatch(repository, new ObjectMapper());
    }

    @Test
    void send_uninstallRequest_pendingRowSavedThenPublished() {
        // setup
        ClientUninstallMessage message = new ClientUninstallMessage();
        message.setIssuedAt(ISSUED_AT);
        DeliveryRequest request = DeliveryRequest.builder()
                .kind(DeliveryKind.CLIENT_UNINSTALL)
                .targetId(MACHINE_ID)
                .machineId(MACHINE_ID)
                .payload(message)
                .offlineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT)
                .build();

        // execution
        dispatch.send(request, publish);

        // verifications
        verify(repository).save(deliveryCaptor.capture());
        MachineDelivery saved = deliveryCaptor.getValue();
        assertThat(saved.getId()).isEqualTo("CLIENT_UNINSTALL:mach-42:mach-42");
        assertThat(saved.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(saved.getAttempts()).isZero();
        assertThat(saved.getPayloadJson()).contains(ISSUED_AT);
        assertThat(saved.getOfflineBehavior()).isEqualTo(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        assertThat(saved.getDispatchedAt()).isEqualTo(saved.getLastAttemptAt());
        verify(publish).run();
    }
}
