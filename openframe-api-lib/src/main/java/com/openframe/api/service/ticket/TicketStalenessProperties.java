package com.openframe.api.service.ticket;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "openframe.tickets.staleness")
public class TicketStalenessProperties {

    private int defaultMinutes = 120;
}
