package com.openframe.kafka.model;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
public class OpenframeEvent implements KafkaMessage {

    private String id;
    private String type;
    private String payload;
    private Instant timestamp;
    private String userId;

    public OpenframeEvent(String id, String type, String payload, Instant timestamp, String userId) {
        this.id = id;
        this.type = type;
        this.payload = payload;
        this.timestamp = timestamp;
        this.userId = userId;
    }
}
