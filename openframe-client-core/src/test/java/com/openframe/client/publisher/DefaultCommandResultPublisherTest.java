package com.openframe.client.publisher;

import com.openframe.kafka.enumeration.KafkaHeader;
import com.openframe.kafka.model.KafkaMessage;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.mockito.Mockito.verify;

/**
 * OSS command-result publisher: forwards to the oss-tenant retrying producer with
 * the configured topic, the machineId key, the event payload, and the headers.
 */
@ExtendWith(MockitoExtension.class)
class DefaultCommandResultPublisherTest {

    private static final String TOPIC = "logs.events";
    private static final String KEY = "machine-42";

    @Mock
    private OssTenantRetryingKafkaProducer kafkaProducer;

    @InjectMocks
    private DefaultCommandResultPublisher publisher;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(publisher, "topic", TOPIC);
    }

    @Test
    @DisplayName("publish: delegates to the oss-tenant producer with topic, key, event and headers")
    void publishesToOssTenantProducer() {
        KafkaMessage event = new CommonDebeziumMessage();
        Map<String, Object> headers = Map.of(KafkaHeader.MESSAGE_TYPE_HEADER, "RMM");

        publisher.publish(KEY, event, headers);

        verify(kafkaProducer).publish(TOPIC, KEY, event, headers);
    }
}
