package com.openframe.kafka.enumeration;

import lombok.Getter;

@Getter
public enum KafkaTopicDestination {

    INBOUND_DIRECTION ("inbound"),
    OUTBOUND_DIRECTION("outbound");

    private String value;
    private KafkaTopicDestination(String value) {
        this.value = value;
    }

}
