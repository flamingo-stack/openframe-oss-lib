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
        @CompoundIndex(name = "name_unique", def = "{'name': 1}", unique = true),
        @CompoundIndex(name = "kind_unique", def = "{'kind': 1}", unique = true,
                partialFilter = "{'kind': {$in: ['AI_ASSISTANCE', 'TECH_REQUIRED', 'RESOLVED', 'ARCHIVED']}}")
})
public class TicketStatusDefinition {

    @Id
    private String id;

    private TicketStatusKind kind;

    private String name;

    private String color;

    private String position;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
