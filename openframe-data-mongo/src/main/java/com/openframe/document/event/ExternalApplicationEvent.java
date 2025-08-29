package com.openframe.document.event;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

@Data
@Document(collection = "external_application_events")
public class ExternalApplicationEvent {
    @Id
    private String id;
    private String type;
    private String payload;
    private Instant timestamp;
    private String userId;
    private EventMetadata metadata;

    @Data
    public static class EventMetadata {
        private String source;
        private String version;
        private Map<String, String> tags;
    }
}