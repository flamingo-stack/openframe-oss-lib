// services/openframe-core/src/main/java/com/openframe/core/model/CoreEvent.java
package com.openframe.documents.event;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "events")
public class CoreEvent {
    @Id
    private String id;
    private String type;
    private String payload;
    private Instant timestamp;
    private String userId;
    private EventStatus status;

    public enum EventStatus {
        CREATED, PROCESSING, COMPLETED, FAILED
    }
}