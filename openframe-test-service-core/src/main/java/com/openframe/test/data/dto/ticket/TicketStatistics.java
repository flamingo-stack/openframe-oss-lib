package com.openframe.test.data.dto.ticket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Tenant-wide ticket counts and averages ({@code ticketStatistics}); the legacy enum counts are not selected. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TicketStatistics {
    private Integer totalCount;
    private List<TicketStatusDefinitionCount> statusDefinitionCounts;
    private String averageResolutionTimeFormatted;
    private Double averageRating;
}
