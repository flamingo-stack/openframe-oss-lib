package com.openframe.debezium.recovery.gap;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import tools.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SnapshotSignalPublisherTest {

    private final SnapshotSignalPublisher publisher =
            new SnapshotSignalPublisher(new ObjectMapper(), new GapRecoveryProperties(), new SignalKafkaClients());

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "source,kafka | shared.meshcentral.debezium-signal | kafka:9092 | true",
            "kafka        | shared.meshcentral.debezium-signal | kafka:9092 | true",
            "source       | shared.meshcentral.debezium-signal | kafka:9092 | false",
            "             | shared.meshcentral.debezium-signal | kafka:9092 | false",
            "kafka        | shared.meshcentral.debezium-signal |            | false",
            "kafka        |                                    | kafka:9092 | false",
            "kafka        | ' '                                | kafka:9092 | false"
    })
    void hasSignalChannel_byChannelsTopicAndBootstrap_onlyWhenKafkaChannelFullySet(
            String channels, String topic, String bootstrapServers, boolean expected) {
        // setup
        Map<String, Object> config = new HashMap<>();
        config.put("signal.enabled.channels", channels);
        config.put("signal.kafka.topic", topic);
        config.put("signal.kafka.bootstrap.servers", bootstrapServers);

        // execution
        boolean hasChannel = publisher.hasSignalChannel(config);

        // verifications
        assertThat(hasChannel).isEqualTo(expected);
    }
}
