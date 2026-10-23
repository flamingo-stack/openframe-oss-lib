package com.openframe.publishing.persistence;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "outbox")
public class OutboxEvent implements TenantScoped {

    @Id
    private String id;

    private String aggregateType;
    private String aggregateId;
    private String tenantId;

    // Expires through the TTL index of OutboxIndexInitializer.
    private Instant occurredAt;

    // Written even when null: Debezium's outbox router needs the key, and turns a null payload into a tombstone.
    @Field(write = Field.Write.ALWAYS)
    private Map<String, Object> payload;
}
