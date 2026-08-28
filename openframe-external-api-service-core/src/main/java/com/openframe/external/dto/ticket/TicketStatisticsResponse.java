package com.openframe.external.dto.ticket;

import com.openframe.data.document.ticket.TicketStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Ticket statistics")
public class TicketStatisticsResponse {

    @Schema(description = "Total number of tickets")
    private Integer totalCount;

    @Schema(description = "Counts per legacy status (empty on lifecycle tenants)")
    private List<StatusCount> statusCounts;

    @Schema(description = "Counts per lifecycle status (empty when lifecycle is disabled)")
    private List<StatusDefinitionCount> statusDefinitionCounts;

    @Schema(description = "Average resolution time as HH:mm:ss", example = "02:15:07")
    private String averageResolutionTimeFormatted;

    @Schema(description = "Average end-user rating")
    private Double averageRating;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StatusCount {
        private TicketStatus status;
        private Integer count;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StatusDefinitionCount {
        private TicketStatusResponse status;
        private Integer count;
    }
}
