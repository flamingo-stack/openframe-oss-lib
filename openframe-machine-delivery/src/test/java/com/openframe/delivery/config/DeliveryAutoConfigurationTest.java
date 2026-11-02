package com.openframe.delivery.config;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.dispatch.DeliveryDispatchMessage;
import com.openframe.delivery.dispatch.DeliverySink;
import com.openframe.delivery.dispatch.KafkaDeliverySink;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.TestPayload;
import com.openframe.kafka.producer.DualWriteKafkaProducer;
import com.openframe.kafka.producer.OssTenantKafkaProducer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

// the sink must come up whatever order the service registers its configurations in: a service that reads the
// delivery configuration before the Kafka one has no producer bean yet at condition time (management did)
class DeliveryAutoConfigurationTest {

    private static final String TOPIC = "tenants.t1.delivery-dispatch";
    private static final String MACHINE_ID = "mach-42";

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withPropertyValues(
                    "openframe.delivery.dispatch-topic=" + TOPIC,
                    "spring.oss-tenant.kafka.enabled=true");

    @Test
    void context_handOffReadBeforeTheProducerIsRegistered_kafkaSinkStillCreated() {
        runner.withUserConfiguration(DeliveryAutoConfiguration.KafkaHandOff.class, Collaborators.class, ProducerRegisteredLater.class)
                .run(context -> assertThat(context).getBean(DeliverySink.class).isInstanceOf(KafkaDeliverySink.class));
    }

    @Test
    void context_dualWriteProducerPresent_handOffSentThroughIt() {
        runner.withUserConfiguration(DeliveryAutoConfiguration.KafkaHandOff.class, Collaborators.class, ProducerRegisteredLater.class, DualWrite.class)
                .run(context -> {
                    context.getBean(DeliverySink.class).accept(handOff());

                    verify(context.getBean(DualWriteKafkaProducer.class)).sendAndAwaitMessage(eq(TOPIC), any(DeliveryDispatchMessage.class), eq(MACHINE_ID));
                    verifyNoInteractions(context.getBean(OssTenantKafkaProducer.class));
                });
    }

    @Test
    void context_tenantKafkaOff_noKafkaSink() {
        runner.withPropertyValues("spring.oss-tenant.kafka.enabled=false")
                .withUserConfiguration(DeliveryAutoConfiguration.KafkaHandOff.class, Collaborators.class, ProducerRegisteredLater.class)
                .run(context -> assertThat(context).doesNotHaveBean(DeliverySink.class));
    }

    @Test
    void context_aSinkAlreadyThere_kafkaSinkStepsAside() {
        runner.withUserConfiguration(OwnSink.class, DeliveryAutoConfiguration.KafkaHandOff.class, Collaborators.class, ProducerRegisteredLater.class)
                .run(context -> assertThat(context).getBean(DeliverySink.class).isNotInstanceOf(KafkaDeliverySink.class));
    }

    private static DeliveryRequest<TestPayload> handOff() {
        TestPayload payload = new TestPayload();
        payload.setDelivery(new DeliveryRef(DeliveryType.TOOL_INSTALLATION, "fleetmdm-agent", "d-1"));
        return DeliveryRequest.<TestPayload>builder()
                .type(DeliveryType.TOOL_INSTALLATION)
                .targetId("fleetmdm-agent")
                .machineId(MACHINE_ID)
                .payload(payload)
                .build();
    }

    @Configuration
    static class DualWrite {

        @Bean
        DualWriteKafkaProducer dualWriteKafkaProducer() {
            return mock(DualWriteKafkaProducer.class);
        }
    }

    @Configuration
    static class Collaborators {

        @Bean
        ObjectMapper objectMapper() {
            return new JsonMapper();
        }

        @Bean
        DeliveryMetrics deliveryMetrics() {
            return mock(DeliveryMetrics.class);
        }

        @Bean
        DeliveryProperties deliveryProperties() {
            DeliveryProperties properties = new DeliveryProperties();
            properties.setDispatchTopic(TOPIC);
            return properties;
        }
    }

    @Configuration
    static class ProducerRegisteredLater {

        @Bean
        OssTenantKafkaProducer ossTenantKafkaProducer() {
            return mock(OssTenantKafkaProducer.class);
        }
    }

    @Configuration
    static class OwnSink {

        @Bean
        DeliverySink localDeliverySink() {
            return mock(DeliverySink.class);
        }
    }
}
