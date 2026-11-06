package com.openframe.kafka.producer.retry;

import com.openframe.kafka.model.KafkaMessage;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.producer.DualWriteKafkaProducer;
import com.openframe.kafka.producer.OssTenantKafkaProducer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;


import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class OssTenantRetryingKafkaProducerTest {

    private static final String TOPIC = "shared.devices-topic";
    private static final String KEY = "machine-42";

    @Mock
    private OssTenantKafkaProducer ossTenantKafkaProducer;

    @Mock
    private DualWriteKafkaProducer dualWriteKafkaProducer;

    @Mock
    private KafkaRecoveryHandler recoveryHandler;

    private final KafkaMessage payload = new CommonDebeziumMessage();

    @Test
    void publish_dualWriteProducerProvided_sendsThroughDualWriteProducer() {
        producer(dualWriteKafkaProducer).publish(TOPIC, KEY, payload);

        verify(dualWriteKafkaProducer).sendAndAwaitMessage(TOPIC, payload, KEY);
    }

    @Test
    void publish_noDualWriteProducer_sendsThroughOssTenantProducer() {
        producer(null).publish(TOPIC, KEY, payload);

        verify(ossTenantKafkaProducer).sendAndAwaitMessage(TOPIC, payload, KEY);
    }

    @Test
    void constructor_dualWriteBeanPresent_springInjectsItAndDestroysItAfterThisBean() {
        contextRunner()
                .withBean("dualWriteKafkaProducer", DualWriteKafkaProducer.class, () -> dualWriteKafkaProducer)
                .run(context -> assertThat(context.getBeanFactory().getDependentBeans("dualWriteKafkaProducer"))
                        .containsExactly("ossTenantRetryingKafkaProducer"));
    }

    @Test
    void constructor_noDualWriteBean_springCreatesItWithOssTenantProducer() {
        contextRunner().run(context -> context.getBean(OssTenantRetryingKafkaProducer.class).publish(TOPIC, KEY, payload));

        verify(ossTenantKafkaProducer).sendAndAwaitMessage(TOPIC, payload, KEY);
    }

    private OssTenantRetryingKafkaProducer producer(DualWriteKafkaProducer dualWriteProducer) {
        return new OssTenantRetryingKafkaProducer(ossTenantKafkaProducer, dualWriteProducer, recoveryHandler);
    }

    private ApplicationContextRunner contextRunner() {
        return new ApplicationContextRunner()
                .withPropertyValues("spring.oss-tenant.kafka.enabled=true")
                .withBean(OssTenantKafkaProducer.class, () -> ossTenantKafkaProducer)
                .withBean(KafkaRecoveryHandler.class, () -> recoveryHandler)
                .withBean("ossTenantRetryingKafkaProducer", OssTenantRetryingKafkaProducer.class);
    }
}
