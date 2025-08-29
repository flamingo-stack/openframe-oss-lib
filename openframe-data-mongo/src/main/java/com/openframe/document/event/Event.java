package com.openframe.document.event;

import lombok.Builder;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "events")
@Data
@Builder
public class Event {
    @Id
    private String id;
    private String type;
    private String payload;
    private Instant timestamp;
    private String userId;
}
