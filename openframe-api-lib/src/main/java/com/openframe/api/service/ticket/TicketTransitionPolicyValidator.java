package com.openframe.api.service.ticket;

import com.openframe.api.exception.ticket.InvalidTicketTransitionException;
import com.openframe.api.exception.ticket.TicketStatusNotFoundException;
import com.openframe.api.service.ticket.spi.TicketClientConversationGate;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketResolver;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusHistory;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.repository.ticket.TicketStatusDefinitionRepository;
import com.openframe.data.repository.ticket.TicketStatusHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.openframe.data.document.ticket.TicketStatusKind.*;

/**
 * The allowed-transition matrix between status kinds, plus the reopen-to-assistant rule.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TicketTransitionPolicyValidator {

    public static final Set<TicketStatusKind> MANUALLY_CREATABLE_KINDS =
            Set.of(TicketStatusKind.CUSTOM, TicketStatusKind.TECH_REQUIRED);

    private static final Map<TicketStatusKind, Set<TicketStatusKind>> ALLOWED = Map.of(
            AI_ASSISTANCE, Set.of(TECH_REQUIRED, CUSTOM, RESOLVED),
            TECH_REQUIRED, Set.of(CUSTOM, RESOLVED),
            CUSTOM, Set.of(TECH_REQUIRED, CUSTOM, RESOLVED),
            RESOLVED, Set.of(ARCHIVED, AI_ASSISTANCE, TECH_REQUIRED, CUSTOM),
            ARCHIVED, Set.of(RESOLVED, AI_ASSISTANCE, TECH_REQUIRED, CUSTOM)
    );

    private final TicketStatusDefinitionRepository statusRepository;
    private final TicketStatusHistoryRepository historyRepository;
    private final ObjectProvider<TicketClientConversationGate> conversationGate;

    public TicketStatusDefinition validateAndResolve(Ticket ticket, String toStatusId) {
        TicketStatusDefinition target = resolveTarget(toStatusId);
        TicketStatusKind currentKind = ticket.getStatusKind();
        TicketStatusKind targetKind = target.getKind();
        if (isSameStatus(ticket, target)) {
            return target;
        }
        if (!isAllowedKindTransition(currentKind, targetKind) || !mayReopenInto(ticket, target)) {
            throw buildInvalidTransition(ticket, targetKind);
        }
        return target;
    }

    public List<TicketStatusDefinition> allowedNext(Ticket ticket) {
        Set<TicketStatusKind> allowedKinds = allowedKinds(ticket.getStatusKind());
        return statusRepository.findAllByOrderByPositionAsc().stream()
                .filter(status -> allowedKinds.contains(status.getKind()))
                .filter(status -> !isSameStatusId(status, ticket))
                .filter(this::isManuallySelectable)
                .filter(status -> mayReopenInto(ticket, status))
                .toList();
    }

    /**
     * A closed ticket can go back to the assistant only when it never left the assistant: a client
     * conversation exists and the ticket has never been in Tech Required or a custom status —
     * once people owned it, reopening returns it to people. Applied both when offering targets
     * and when validating the actual transition, so the board drag and the raw API obey the same
     * rule the dropdown shows.
     */
    private boolean mayReopenInto(Ticket ticket, TicketStatusDefinition target) {
        boolean reopeningToAi = isClosed(ticket.getStatusKind()) && target.getKind() == AI_ASSISTANCE;
        return !reopeningToAi || stayedWithTheAssistant(ticket);
    }

    /**
     * Tickets closed before the history collection existed have no rows; for them the assistant's
     * own closure (the client asked or agreed) is the only trusted proof the ticket never left.
     */
    private boolean stayedWithTheAssistant(Ticket ticket) {
        if (!hasClientConversation(ticket)) {
            return false;
        }
        List<TicketStatusHistory> history =
                historyRepository.findByTicketIdOrderByCreatedAtAsc(ticket.getId());
        if (history.isEmpty()) {
            return ticket.getResolvedBy() == TicketResolver.END_USER;
        }
        return history.stream().noneMatch(TicketTransitionPolicyValidator::touchesHumanStage);
    }

    private boolean hasClientConversation(Ticket ticket) {
        TicketClientConversationGate gate = conversationGate.getIfAvailable();
        return gate != null && gate.hasClientConversation(ticket.getId());
    }

    private static boolean touchesHumanStage(TicketStatusHistory record) {
        return isHumanStage(record.getFromStatusKind()) || isHumanStage(record.getToStatusKind());
    }

    private static boolean isHumanStage(String kind) {
        return TECH_REQUIRED.name().equals(kind) || CUSTOM.name().equals(kind);
    }

    private static boolean isClosed(TicketStatusKind kind) {
        return kind == RESOLVED || kind == ARCHIVED;
    }

    public Set<TicketStatusKind> allowedKinds(TicketStatusKind from) {
        return ALLOWED.getOrDefault(from, Set.of());
    }

    public List<TicketStatusDefinition> allowedNextFor(TicketStatusDefinition from,
                                                       List<TicketStatusDefinition> all) {
        Set<TicketStatusKind> allowedKinds = allowedKinds(from.getKind());
        return all.stream()
                .filter(status -> allowedKinds.contains(status.getKind()))
                .filter(status -> !status.getId().equals(from.getId()))
                .filter(this::isManuallySelectable)
                .toList();
    }

    /** AI Handling is the assistant's stage — automated flows enter it, pickers never offer it. */
    private boolean isManuallySelectable(TicketStatusDefinition status) {
        return status.getKind() != AI_ASSISTANCE;
    }

    private TicketStatusDefinition resolveTarget(String toStatusId) {
        return statusRepository.findById(toStatusId)
                .orElseThrow(() -> new TicketStatusNotFoundException(toStatusId));
    }

    private boolean isSameStatus(Ticket ticket, TicketStatusDefinition target) {
        return target.getId() != null && target.getId().equals(ticket.getStatusId());
    }

    private boolean isSameStatusId(TicketStatusDefinition status, Ticket ticket) {
        return status.getId() != null && status.getId().equals(ticket.getStatusId());
    }

    private boolean isAllowedKindTransition(TicketStatusKind from, TicketStatusKind to) {
        return ALLOWED.getOrDefault(from, Set.of()).contains(to);
    }

    private InvalidTicketTransitionException buildInvalidTransition(Ticket ticket, TicketStatusKind to) {
        List<String> allowedIds = allowedNext(ticket).stream()
                .map(TicketStatusDefinition::getId)
                .toList();
        return new InvalidTicketTransitionException(ticket.getStatusKind(), to, allowedIds);
    }
}
