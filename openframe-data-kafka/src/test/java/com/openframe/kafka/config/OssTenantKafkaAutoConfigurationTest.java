package com.openframe.kafka.config;

import com.openframe.kafka.model.KafkaMessage;
import com.openframe.kafka.producer.DualWriteKafkaProducer;
import com.openframe.kafka.producer.OssTenantKafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerInterceptor;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.errors.TimeoutException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.assertj.AssertableApplicationContext;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.kafka.KafkaException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

class OssTenantKafkaAutoConfigurationTest {

    private static final String PRIMARY_CLUSTER = "127.0.0.1:1";
    private static final String SECONDARY_CLUSTER = "127.0.0.2:9092";

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(OssTenantKafkaAutoConfiguration.class))
            .withPropertyValues(
                    "spring.oss-tenant.kafka.enabled=true",
                    "spring.oss-tenant.kafka.bootstrap-servers=" + SECONDARY_CLUSTER,
                    "spring.oss-tenant.kafka.producer.properties[max.block.ms]=1500",
                    "spring.oss-tenant.kafka.producer.properties[interceptor.classes]="
                            + RecordingProducerInterceptor.class.getName());

    private final KafkaMessage message = new KafkaMessage() {
    };

    @BeforeEach
    void resetInterceptor() {
        RecordingProducerInterceptor.configs.clear();
        RecordingProducerInterceptor.closed = 0;
    }

    @Test
    void dualWriteKafkaProducer_noDualWriteServers_noDualWriteProducer() {
        contextRunner.run(context -> assertThat(context)
                .hasSingleBean(OssTenantKafkaProducer.class)
                .doesNotHaveBean(DualWriteKafkaProducer.class));
    }

    @Test
    @Timeout(10)
    void dualWriteKafkaProducer_primaryUnreachable_rowFailsAfterTheConfiguredBlockAndNothingGoesToTheSecondary() {
        dualWriteContext().run(context -> assertThatThrownBy(() -> sendRow(context))
                .isInstanceOf(KafkaException.class)
                .rootCause().isInstanceOf(TimeoutException.class));

        assertThat(RecordingProducerInterceptor.configs)
                .extracting(configs -> configs.get(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG),
                        configs -> String.valueOf(configs.get(ProducerConfig.MAX_BLOCK_MS_CONFIG)))
                .containsExactly(tuple(PRIMARY_CLUSTER, "1500"));
    }

    @Test
    @Timeout(10)
    void dualWriteKafkaProducer_contextClosed_closesThePrimaryProducer() {
        dualWriteContext().run(context -> {
            assertThatThrownBy(() -> sendRow(context)).isInstanceOf(KafkaException.class);
            assertThat(RecordingProducerInterceptor.closed).isZero();
        });

        assertThat(RecordingProducerInterceptor.closed).isEqualTo(1);
    }

    private ApplicationContextRunner dualWriteContext() {
        return contextRunner.withPropertyValues("spring.oss-tenant.dual-write-bootstrap-servers=" + PRIMARY_CLUSTER);
    }

    private void sendRow(AssertableApplicationContext context) {
        context.getBean(DualWriteKafkaProducer.class).sendAndAwaitMessage("devices", message, "device-1");
    }

    public static class RecordingProducerInterceptor implements ProducerInterceptor<String, Object> {

        static final List<Map<String, Object>> configs = new ArrayList<>();
        static int closed;

        @Override
        public ProducerRecord<String, Object> onSend(ProducerRecord<String, Object> record) {
            return record;
        }

        @Override
        public void close() {
            closed++;
        }

        @Override
        public void configure(Map<String, ?> configs) {
            RecordingProducerInterceptor.configs.add(new HashMap<>(configs));
        }
    }
}
