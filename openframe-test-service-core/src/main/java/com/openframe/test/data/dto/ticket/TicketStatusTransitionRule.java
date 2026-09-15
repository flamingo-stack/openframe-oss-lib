package com.openframe.test.data.dto.ticket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** One row of the lifecycle transition matrix: the statuses a ticket in {@code from} may move to. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TicketStatusTransitionRule {
    private TicketStatusDefinition from;
    private List<TicketStatusDefinition> to;
}
