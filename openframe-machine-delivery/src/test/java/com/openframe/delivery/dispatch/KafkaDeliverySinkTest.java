package com.openframe.delivery.dispatch;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.TestPayload;
import com.openframe.kafka.producer.OssTenantKafkaProducer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class KafkaDeliverySinkTest {

    private static final String TOPIC = "dev.delivery.dispatch.tenant-1";
    private static final String MACHINE_ID = "mach-42";
    private static final String TARGET_ID = "fleetmdm-agent";
    private static final String DISPATCH_ID = "d-1";

    @Mock private OssTenantKafkaProducer producer;
    @Mock private DeliveryMetrics metrics;

    @Captor private ArgumentCaptor<DeliveryDispatchMessage> messageCaptor;

    private KafkaDeliverySink sink;
    private DeliveryRequest<TestPayload> request;

    @BeforeEach
    void setUp() {
        sink = new KafkaDeliverySink(producer, new ObjectMapper(), metrics, TOPIC);
        TestPayload payload = new TestPayload();
        payload.setValue("issued");
        payload.setDelivery(new DeliveryRef(DeliveryType.TOOL_INSTALLATION, TARGET_ID, DISPATCH_ID));
        request = DeliveryRequest.<TestPayload>builder()
                .type(DeliveryType.TOOL_INSTALLATION)
                .targetId(TARGET_ID)
                .machineId(MACHINE_ID)
                .payload(payload)
                .build();
    }

    @Test
    void accept_request_commandSentKeyedByMachineAndCounted() {
        // execution
        sink.accept(request);

        // verifications
        verify(producer).sendAndAwait(eq(TOPIC), eq(MACHINE_ID), messageCaptor.capture());
        DeliveryDispatchMessage message = messageCaptor.getValue();
        assertThat(message.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(message.getPayload().get("delivery").get("dispatchId").asText()).isEqualTo(DISPATCH_ID);
        assertThat(message.getPayload().get("value").asText()).isEqualTo("issued");
        verify(metrics).recordDispatched(DeliveryType.TOOL_INSTALLATION, "kafka");
    }

    @Test
    void accept_kafkaDown_countedAndRethrownToTheCaller() {
        // setup
        doThrow(new IllegalStateException("kafka down")).when(producer).sendAndAwait(eq(TOPIC), eq(MACHINE_ID), any());

        // execution + verifications
        assertThatThrownBy(() -> sink.accept(request)).isInstanceOf(IllegalStateException.class);
        verify(metrics).recordDispatchFailed(DeliveryType.TOOL_INSTALLATION);
    }
}
