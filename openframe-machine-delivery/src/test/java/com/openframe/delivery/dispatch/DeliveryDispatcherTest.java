package com.openframe.delivery.dispatch;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import com.openframe.delivery.spec.TestPayload;
import com.openframe.delivery.spec.TestSeed;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryDispatcherTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TARGET_ID = "fleetmdm-agent";
    private static final String VALUE = "issued";

    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliverySpec<TestSeed, TestPayload> spec;
    @Mock private ObjectProvider<DeliverySink> sinkProvider;
    @Mock private DeliverySink sink;

    @InjectMocks private DeliveryDispatcher dispatcher;

    private TestSeed seed;
    private TestPayload payload;
    private DeliveryRequest<TestPayload> request;

    @BeforeEach
    void setUp() {
        seed = new TestSeed(MACHINE_ID);
        payload = new TestPayload();
        payload.setValue(VALUE);
        request = DeliveryRequest.<TestPayload>builder()
                .type(DeliveryType.TOOL_INSTALLATION)
                .targetId(TARGET_ID)
                .machineId(MACHINE_ID)
                .payload(payload)
                .build();
    }

    @Test
    void dispatch_seed_dispatchIdStampedThenRequestHandedToSink() {
        // setup
        doReturn(spec).when(registry).require(DeliveryType.TOOL_INSTALLATION);
        when(spec.request(seed)).thenReturn(request);
        when(sinkProvider.getObject()).thenReturn(sink);

        // execution
        dispatcher.dispatch(seed);

        // verifications
        assertThat(payload.getDelivery().getType()).isEqualTo(DeliveryType.TOOL_INSTALLATION);
        assertThat(payload.getDelivery().getTargetId()).isEqualTo(TARGET_ID);
        assertThat(payload.getDelivery().getDispatchId()).isNotBlank();
        verify(sink).accept(request);
    }

    @Test
    void dispatch_unregisteredType_throwsWithoutHandOff() {
        // setup
        when(registry.require(DeliveryType.TOOL_INSTALLATION))
                .thenThrow(new IllegalArgumentException("No spec registered for delivery type: TOOL_INSTALLATION"));

        // execution + verifications
        assertThatThrownBy(() -> dispatcher.dispatch(seed)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(sinkProvider);
    }
}
