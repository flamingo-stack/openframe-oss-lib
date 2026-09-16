package com.openframe.data.nats.delivery;

import com.openframe.data.document.rmm.delivery.DeliveryKind;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class PublishOnlyDeliveryDispatchTest {

    private static final String MACHINE_ID = "mach-42";

    @Mock private Runnable publish;

    @Test
    void send_anyRequest_publishedWithoutRow() {
        // setup
        PublishOnlyDeliveryDispatch dispatch = new PublishOnlyDeliveryDispatch();
        DeliveryRequest request = DeliveryRequest.builder()
                .kind(DeliveryKind.CLIENT_UNINSTALL)
                .targetId(MACHINE_ID)
                .machineId(MACHINE_ID)
                .build();

        // execution
        dispatch.send(request, publish);

        // verifications
        verify(publish).run();
    }
}
