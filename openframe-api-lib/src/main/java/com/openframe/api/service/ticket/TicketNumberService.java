package com.openframe.api.service.ticket;

import com.openframe.data.repository.sequence.SequenceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** Per-tenant sequential ticket numbers backed by the {@code sequences} counter collection. */
@Service
@Slf4j
@RequiredArgsConstructor
public class TicketNumberService {

    private static final String SEQUENCE_NAME = "ticket_number";

    private final SequenceRepository sequenceRepository;

    public int getNextTicketNumber() {
        int ticketNumber = sequenceRepository.getNextValue(SEQUENCE_NAME);
        log.debug("Generated ticket number: {}", ticketNumber);
        return ticketNumber;
    }
}
