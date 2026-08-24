package com.openframe.api.service.ticket;

import com.openframe.api.exception.ticket.InvalidTicketTransitionException;
import com.openframe.api.exception.ticket.TicketStatusNotFoundException;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketResolver;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.repository.ticket.TicketStatusDefinitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.openframe.data.document.ticket.TicketStatusKind.*;

/**
 * The allowed-transition matrix between status kinds, plus the reopen-to-AI rule.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = TicketFeature.ENABLED, havingValue = "true")
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
                .filter(status -> mayReopenInto(ticket, status))
                .toList();
    }

    /** A closed ticket may only go back to the assistant when the end user was the one who closed it. */
    private static boolean mayReopenInto(Ticket ticket, TicketStatusDefinition target) {
        boolean reopeningToAi = isClosed(ticket.getStatusKind()) && target.getKind() == AI_ASSISTANCE;
        return !reopeningToAi || ticket.getResolvedBy() == TicketResolver.END_USER;
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
                .toList();
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
