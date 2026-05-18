package com.openframe.data.document.connector;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Records a single recreate-under-new-version event for a Debezium connector base name.
 * Used by the recovery rate limiter to enforce a rolling-window cap across all
 * management replicas. Old events are purged on each write — no TTL index needed.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "connector_recreation_events")
public class ConnectorRecreationEvent {

    @Id
    private String id;
    private String baseName;
    private Instant createdAt;
}
