package com.openframe.api.service.ticket;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Deployment-wide staleness defaults for the board. A status definition may override the threshold
 * for its own column; this is the value used wherever it does not.
 */
@Data
@Component
@ConfigurationProperties(prefix = "openframe.tickets.staleness")
public class TicketStalenessProperties {

    /** Minutes without activity after which a ticket counts as stale. */
    private int defaultMinutes = 120;
}
