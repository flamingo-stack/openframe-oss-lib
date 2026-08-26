package com.openframe.external.service;

import com.openframe.api.service.ticket.TicketLifecycleService;
import com.openframe.api.service.ticket.TicketNoteService;
import com.openframe.api.service.ticket.TicketStatusService;
import com.openframe.api.service.ticket.TicketTagService;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketAttachment;
import com.openframe.data.document.ticket.TicketNote;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.repository.ticket.TicketAttachmentRepository;
import com.openframe.external.dto.ticket.TicketResponse;
import com.openframe.external.mapper.TicketMapper;
import com.openframe.external.mapper.TicketMapper.TicketRelations;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Assembles full ticket representations (tags, notes, attachments, lifecycle status and allowed
 * transitions) for the REST API, batching the related lookups per page.
 */
@Service
@RequiredArgsConstructor
public class TicketReadService {

    private final TicketTagService ticketTagService;
    private final TicketNoteService ticketNoteService;
    private final TicketAttachmentRepository ticketAttachmentRepository;
    private final TicketStatusService ticketStatusService;
    private final TicketLifecycleService ticketLifecycleService;
    private final TicketMapper ticketMapper;

    public TicketResponse toResponse(AuthPrincipal principal, Ticket ticket) {
        return toResponses(principal, List.of(ticket), true).getFirst();
    }

    /** List variant: skips per-ticket availableTransitions (each one costs status/gate/history reads). */
    public List<TicketResponse> toResponses(AuthPrincipal principal, List<Ticket> tickets) {
        return toResponses(principal, tickets, false);
    }

    private List<TicketResponse> toResponses(AuthPrincipal principal, List<Ticket> tickets, boolean includeTransitions) {
        if (tickets.isEmpty()) {
            return List.of();
        }
        List<String> ticketIds = tickets.stream().map(Ticket::getId).toList();
        List<List<Tag>> tagsPerTicket = ticketTagService.getTagsByTicketIds(ticketIds);
        List<List<TicketNote>> notesPerTicket = ticketNoteService.getNotesByTicketIds(ticketIds);
        Map<String, List<TicketAttachment>> attachmentsByTicket = ticketAttachmentRepository.findByTicketIdIn(ticketIds)
                .stream()
                .collect(Collectors.groupingBy(TicketAttachment::getTicketId));
        Map<String, TicketStatusDefinition> statusesById = ticketStatusService.list().stream()
                .collect(Collectors.toMap(TicketStatusDefinition::getId, Function.identity(), (a, b) -> a));
        return IntStream.range(0, tickets.size())
                .mapToObj(i -> {
                    Ticket ticket = tickets.get(i);
                    TicketRelations relations = new TicketRelations(
                            tagsPerTicket.get(i),
                            notesPerTicket.get(i),
                            attachmentsByTicket.getOrDefault(ticket.getId(), List.of()),
                            ticket.getStatusId() != null ? statusesById.get(ticket.getStatusId()) : null,
                            includeTransitions && ticket.getStatusKind() != null
                                    ? ticketLifecycleService.availableTransitionsFor(principal, ticket) : null);
                    return ticketMapper.toTicketResponse(ticket, relations);
                })
                .toList();
    }
}
