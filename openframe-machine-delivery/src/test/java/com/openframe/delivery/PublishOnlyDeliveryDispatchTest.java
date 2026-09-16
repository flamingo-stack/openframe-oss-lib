package com.openframe.delivery;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class PublishOnlyDeliveryDispatchTest {

    private static final String MACHINE_ID = "mach-42";

    @Mock private DeliverySpec<TestPayload> spec;

    @Test
    void send_request_publishedThroughSpecWithoutRow() {
        // setup
        PublishOnlyDeliveryDispatch dispatch = new PublishOnlyDeliveryDispatch();
        TestPayload payload = new TestPayload();
        DeliveryRequest<TestPayload> request = DeliveryRequest.<TestPayload>builder()
                .spec(spec)
                .targetId(MACHINE_ID)
                .machineId(MACHINE_ID)
                .payload(payload)
                .build();

        // execution
        dispatch.send(request);

        // verifications
        verify(spec).publish(MACHINE_ID, payload);
    }
}
