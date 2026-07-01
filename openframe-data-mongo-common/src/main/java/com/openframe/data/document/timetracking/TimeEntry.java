package com.openframe.data.document.timetracking;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "time_entries")
@CompoundIndexes({
        @CompoundIndex(
                name = "tenant_user_active",
                def = "{'tenantId': 1, 'userId': 1}",
                unique = true,
                partialFilter = "{ 'endedAt': null }"
        ),
        @CompoundIndex(name = "tenant_user_started", def = "{'tenantId': 1, 'userId': 1, 'startedAt': -1}"),
        @CompoundIndex(name = "tenant_ticket_started", def = "{'tenantId': 1, 'ticketId': 1, 'startedAt': -1}"),
        @CompoundIndex(name = "tenant_org_started", def = "{'tenantId': 1, 'organizationId': 1, 'startedAt': -1}")
})
public class TimeEntry implements TenantScoped {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String userId;
    private String ticketId;
    private Integer ticketNumber;
    private String ticketTitle;
    private String organizationId;
    private String notes;
    private Instant startedAt;

    /** Null while the timer is running or paused; set on stop. */
    private Instant endedAt;

    /** Non-null while the timer is paused. Cleared on resume after accumulating into breakSeconds. */
    private Instant pausedAt;

    private long durationSeconds;
    private long breakSeconds;
    private TimeEntrySource source;

    private String createdBy;

    @CreatedDate
    private Instant createdAt;

    private String lastModifiedBy;

    @LastModifiedDate
    private Instant updatedAt;
}
