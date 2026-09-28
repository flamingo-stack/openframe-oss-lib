package com.openframe.test.data.dto.timetracking;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.UserNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A time entry as exposed by the time-tracking GraphQL API (openframe-api-service-core
 * {@code time-tracking.graphqls}). {@code state} is RUNNING | PAUSED | COMPLETED, {@code source} is
 * TIMER | MANUAL. {@code userId} and {@code user.id} are both the raw user id; {@code createTimeEntry} /
 * {@code updateTimeEntry} and the employee filters expect the Relay global form instead
 * ({@code RelayIds.userId(rawId)}).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TimeEntry {
    private String id;
    private String userId;
    private UserNode user;
    private String ticketId;
    private Integer ticketNumber;
    private String ticketTitle;
    private String organizationId;
    private String notes;
    private String startedAt;
    private String endedAt;
    private String pausedAt;
    private Long durationSeconds;
    private Long breakSeconds;
    private String state;
    private String source;
    private String createdAt;
    private String updatedAt;
}
