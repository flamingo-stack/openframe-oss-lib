package com.openframe.debezium.recovery.gap;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SnapshotSignalPublisherTest {

    private final SnapshotSignalPublisher publisher = new SnapshotSignalPublisher(new ObjectMapper());

    @ParameterizedTest
    @CsvSource({
            "shared.meshcentral.debezium-signal, kafka:9092, true",
            "shared.meshcentral.debezium-signal, ,           false",
            ",                                   kafka:9092, false",
            "' ',                                kafka:9092, false"
    })
    void hasSignalChannel_byTopicAndBootstrap_onlyWhenBothSet(String topic, String bootstrapServers, boolean expected) {
        // setup
        Map<String, Object> config = new HashMap<>();
        config.put("signal.kafka.topic", topic);
        config.put("signal.kafka.bootstrap.servers", bootstrapServers);

        // execution
        boolean hasChannel = publisher.hasSignalChannel(config);

        // verifications
        assertThat(hasChannel).isEqualTo(expected);
    }
}
