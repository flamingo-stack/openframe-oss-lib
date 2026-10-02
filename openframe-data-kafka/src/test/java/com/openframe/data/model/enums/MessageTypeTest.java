package com.openframe.data.model.enums;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;

class MessageTypeTest {

    @ParameterizedTest
    @EnumSource(MessageType.class)
    void getDestinationList_everyToolEventType_savesDetailsBeforePublishingToTheList(MessageType type) {
        assertThat(type.getDestinationList())
                .extracting(Destination::name)
                .startsWith("CASSANDRA_EVENT_LOG", "KAFKA_PINOT");
    }
}
