package com.openframe.data.timeentry.aspect;

import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.timetracking.TimeEntryRepository;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;

// Registers cascade aspect and service beans; enabled via openframe.timeentry.cascade.enabled
@AutoConfiguration
@ConditionalOnProperty(name = "openframe.timeentry.cascade.enabled", havingValue = "true", matchIfMissing = true)
public class TimeEntryCascadeAutoConfiguration {

    @Bean
    public TimeEntryCascadeService timeEntryCascadeService(TimeEntryRepository timeEntryRepository) {
        return new TimeEntryCascadeService(timeEntryRepository);
    }

    @Bean
    public TimeEntryCascadeAspect timeEntryCascadeAspect(
            TimeEntryCascadeService timeEntryCascadeService,
            TicketRepository ticketRepository) {
        return new TimeEntryCascadeAspect(timeEntryCascadeService, ticketRepository);
    }
}
