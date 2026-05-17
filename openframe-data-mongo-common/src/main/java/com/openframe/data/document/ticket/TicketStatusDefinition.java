package com.openframe.data.document.ticket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ticket_statuses")
@CompoundIndexes({
        @CompoundIndex(name = "tenant_name_unique",
                def = "{'tenantId': 1, 'name': 1}", unique = true),
        @CompoundIndex(name = "tenant_kind_unique",
                def = "{'tenantId': 1, 'kind': 1}", unique = true,
                partialFilter = "{'kind': {$in: ['AI_ASSISTANCE', 'TECH_REQUIRED', 'RESOLVED', 'ARCHIVED']}}"),
        @CompoundIndex(name = "tenant_position",
                def = "{'tenantId': 1, 'position': 1}")
})
public class TicketStatusDefinition {

    @Id
    private String id;

    private String tenantId;

    private TicketStatusKind kind;

    private String name;

    private String color;

    private Integer position;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
