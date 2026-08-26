package com.openframe.api.dto.ticket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketStatistics {
    private Integer totalCount;
    private List<TicketStatusCount> statusCounts;
    private List<TicketStatusDefinitionCount> statusDefinitionCounts;
    private String averageResolutionTimeFormatted;
    private Double averageRating;
}
