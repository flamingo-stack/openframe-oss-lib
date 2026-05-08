package com.openframe.api.service;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.ticket.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

// TODO: Expand with query/pagination methods when PSA migrates from ai-agent to OSS
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class TicketQueryService {

    private final TicketRepository ticketRepository;

    public Optional<Ticket> findById(String ticketId) {
        return ticketRepository.findById(ticketId);
    }
}
