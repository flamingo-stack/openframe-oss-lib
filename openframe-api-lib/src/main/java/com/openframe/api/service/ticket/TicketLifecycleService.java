package com.openframe.api.service.ticket;

import com.github.pravin.raha.lexorank4j.LexoRank;
import com.openframe.api.dto.ticket.ReorderTicketInput;
import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.api.dto.ticket.TransitionTicketInput;
import com.openframe.api.exception.ticket.InvalidTicketTransitionException;
import com.openframe.api.exception.ticket.TicketNotFoundException;
import com.openframe.api.exception.ticket.TicketStatusNotFoundException;
import com.openframe.api.service.ticket.spi.TicketEventListener;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.ticket.TicketStatusDefinitionRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.Valid;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static com.openframe.api.service.ticket.TicketTransitionPolicyValidator.MANUALLY_CREATABLE_KINDS;
import static com.openframe.api.util.AuthPrincipalUtils.validateAdminAccess;
import static com.openframe.data.document.ticket.TicketStatusKind.AI_ASSISTANCE;
import static com.openframe.data.document.ticket.TicketStatusKind.RESOLVED;
import static org.springframework.util.StringUtils.hasText;

/**
 * Lifecycle operations for custom-status tickets.
 */
@Service
@Slf4j
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TicketLifecycleService {

    private final TicketRepository ticketRepository;
    private final TicketStatusDefinitionRepository statusRepository;
    private final TicketTransitionPolicyValidator transitionPolicy;
    private final TenantIdProvider tenantIdProvider;
    private final TicketTagService ticketTagService;
    private final TicketIdsForFilter ticketIdsForFilter;
    private final TicketResolverStamp ticketResolverStamp;
    private final TicketStatusHistoryService historyService;
    private final List<TicketEventListener> listeners;

    @Transactional
    public Ticket transition(AuthPrincipal principal, @Valid TransitionTicketInput input) {
        return doTransition(principal, input, TransitionSource.MANUAL);
    }

    /**
     * The un-proxied transition core: every public transactional entry of this class delegates
     * here, so internal calls never self-invoke another {@code @Transactional} method through
     * {@code this} (the proxy would be bypassed and its settings silently ignored).
     */
    private Ticket doTransition(AuthPrincipal principal, TransitionTicketInput input, TransitionSource source) {
        TransitionContext context = loadContext(input.getTicketId());
        Ticket ticket = context.ticket();
        TicketStatusDefinition target = transitionPolicy.validateAndResolve(ticket, input.getToStatusId());

        if (isSameStatus(context.currentStatus(), target)) {
            return context.ticket();
        }
        validateManualTransition(ticket, target, source);

        boolean reopening = isReopening(context.currentStatus(), target);
        applyTransition(context.ticket(), target);
        // `order` is ranked per column, so a transition must re-rank: a rank minted for the
        // old column drops the ticket at an arbitrary depth in the new one, and collides with
        // its head (every column is seeded from LexoRank.middle()). Newest-on-top, same as a
        // freshly created ticket. Read before the save, so it cannot find ITSELF as the head.
        context.ticket().setOrder(computeRankAtTop(target.getId()));
        stampResolverIfResolved(context.ticket(), target, principal);
        if (reopening) {
            clearResolutionTrace(context.ticket());
        }
        ticketRepository.save(context.ticket());
        String transitionReason = hasText(input.getReopenReason()) ? input.getReopenReason() : input.getReason();
        historyService.record(context.ticket(), context.currentStatus(), target, principal, transitionReason);
        for (TicketEventListener listener : listeners) {
            listener.onTicketTransitioned(context.ticket(), context.currentStatus(), target,
                    principal, reopening, input.getReopenReason());
        }

        log.info("Transitioned ticket {} {} → {} by {}",
                context.ticket().getId(), context.currentStatus().getKind(), target.getKind(),
                principal.getDisplayName());
        return context.ticket();
    }

    /**
     * A reopen is any transition out of a closed stage into an open one. It swaps the generic
     * status-change notification for the dedicated reopen one — admins read "Reopened by …", not
     * "Moved to …" — and fires the shared reopen effects for every path that lands here.
     */
    public static boolean isReopening(TicketStatusDefinition from, TicketStatusDefinition to) {
        return isClosed(from.getKind()) && !isClosed(to.getKind());
    }

    public static boolean isClosed(TicketStatusKind kind) {
        return kind == RESOLVED || kind == TicketStatusKind.ARCHIVED;
    }

    /** Forgets who/when resolved the ticket and counts the reopen; applied before the save. */
    public static void clearResolutionTrace(Ticket ticket) {
        ticket.setResolvedAt(null);
        ticket.setResolvedBy(null);
        ticket.setResolvedById(null);
        ticket.setResolvedByName(null);
        ticket.setReopenCount(ticket.getReopenCount() == null ? 1 : ticket.getReopenCount() + 1);
    }

    /** Transitions a ticket to the system status of the given kind, resolving its status id for this tenant. */
    @Transactional
    public Ticket transitionToKind(AuthPrincipal principal, String ticketId, TicketStatusKind kind, String reason) {
        TicketStatusDefinition target = requireByKind(kind);
        TransitionTicketInput input = TransitionTicketInput.builder()
                .ticketId(ticketId)
                .toStatusId(target.getId())
                .reason(reason)
                .build();
        return doTransition(principal, input, TransitionSource.AUTOMATED);
    }

    /**
     * The client-reopen entry: same transition as {@link #transitionToKind}, plus the modal's
     * "what's still not working" text riding along into the reopen effects.
     */
    @Transactional
    public void reopenToKind(AuthPrincipal principal, String ticketId, TicketStatusKind kind,
                             String reason, String reopenReason) {
        TicketStatusDefinition target = requireByKind(kind);
        TransitionTicketInput input = TransitionTicketInput.builder()
                .ticketId(ticketId)
                .toStatusId(target.getId())
                .reason(reason)
                .reopenReason(reopenReason)
                .build();
        doTransition(principal, input, TransitionSource.AUTOMATED);
    }

    public List<TicketStatusDefinition> availableTransitionsFor(AuthPrincipal principal, Ticket ticket) {
        return transitionPolicy.allowedNext(ticket);
    }

    /**
     * Stamps a newly created ticket with the lifecycle status (statusId/statusKind) that corresponds
     * to its initial legacy {@link TicketStatus}, so the ticket is immediately findable by the
     * custom-status filter (and not only after the next backfill migration run).
     */
    public void applyInitialStatus(Ticket ticket) {
        TicketStatusKind kind = initialKindFor(ticket.getStatus());
        TicketStatusDefinition status = requireByKind(kind);
        ticket.setStatusId(status.getId());
        ticket.setStatusKind(status.getKind());
        log.debug("Applied initial status {} (id={}) to new ticket", kind, status.getId());
    }

    /**
     * Initial status for a manually (admin) created ticket: the chosen status, or the first custom
     * status when none is supplied. Any custom status is allowed, plus the TECH_REQUIRED system
     * status so a technician can file a ticket straight into the Tech Required queue. The remaining
     * system statuses stay off limits — AI_ASSISTANCE is reserved for the AI assistant, and
     * RESOLVED/ARCHIVED are outcomes a ticket has to be transitioned into.
     */
    public void applyManualInitialStatus(Ticket ticket, String requestedStatusId) {
        TicketStatusDefinition target = hasText(requestedStatusId)
                ? requireManuallyCreatableStatus(requestedStatusId)
                : firstCustomStatus();
        ticket.setStatusId(target.getId());
        ticket.setStatusKind(target.getKind());
        log.debug("Applied manual initial status {} (id={}) to new ticket", target.getName(), target.getId());
    }

    private TicketStatusKind initialKindFor(TicketStatus legacyStatus) {
        return switch (legacyStatus) {
            case ACTIVE -> TicketStatusKind.AI_ASSISTANCE;
            case TECH_REQUIRED -> TicketStatusKind.TECH_REQUIRED;
            default -> throw new IllegalStateException("Unsupported initial ticket status: " + legacyStatus);
        };
    }

    private TicketStatusDefinition requireManuallyCreatableStatus(String statusId) {
        TicketStatusDefinition status = statusRepository.findById(statusId)
                .orElseThrow(() -> new TicketStatusNotFoundException(statusId));
        if (!MANUALLY_CREATABLE_KINDS.contains(status.getKind())) {
            throw new IllegalArgumentException(
                    "Tickets cannot be created in the \"" + status.getName() + "\" status");
        }
        return status;
    }

    private TicketStatusDefinition firstCustomStatus() {
        return statusRepository.findByKindOrderByPositionAsc(TicketStatusKind.CUSTOM).stream()
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No custom ticket status configured for this tenant"));
    }

    private TicketStatusDefinition requireByKind(TicketStatusKind kind) {
        return statusRepository.findByKind(kind)
                .orElseThrow(() -> new IllegalStateException(
                        "System ticket status " + kind + " is not seeded for this tenant"));
    }

    @Transactional
    public List<String> archiveResolvedTickets(AuthPrincipal principal, TicketFilterInput filterInput) {
        TicketStatusDefinition resolved = requireByKind(TicketStatusKind.RESOLVED);
        TicketStatusDefinition archived = requireByKind(TicketStatusKind.ARCHIVED);

        String resolvedId = resolved.getId();
        TicketQueryFilter queryFilter = buildArchiveFilter(resolvedId, filterInput);
        List<String> restrictToTicketIds = ticketIdsForFilter.resolve(principal, filterInput);

        Query idsQuery = ticketRepository.buildTicketQuery(queryFilter, null, restrictToTicketIds, null);
        List<String> resolvedIds = ticketRepository.findTicketsWithCursor(idsQuery, null, 0, "order", "ASC")
                .stream().map(Ticket::getId).toList();

        Query updateQuery = ticketRepository.buildTicketQuery(queryFilter, null, restrictToTicketIds, null);
        ticketRepository.reassignTicketsToStatus(updateQuery, archived.getId(), archived.getKind());
        log.info("Archived {} resolved tickets (lifecycle)", resolvedIds.size());
        return resolvedIds;
    }

    @Transactional
    public Ticket reorderTicket(AuthPrincipal principal, @Valid ReorderTicketInput input) {
        validateAdminAccess(principal);
        Ticket ticket = ticketRepository.findById(input.getId())
                .orElseThrow(() -> new TicketNotFoundException(input.getId()));

        String targetStatusId = hasText(input.getStatusId()) ? input.getStatusId() : ticket.getStatusId();

        // Ranked BEFORE the transition, never after: the transition is its own save (plus a
        // history entry and listener notifications no rollback undoes), so ranking afterwards
        // let a failed rank leave the ticket already moved while the caller was told it had
        // not. The anchors are in the target column either way, so they read the same here.
        String newOrder = computeRankBetween(input.getAfterTicketId(), input.getBeforeTicketId(), targetStatusId);

        if (!targetStatusId.equals(ticket.getStatusId())) {
            TransitionTicketInput transitionInput = TransitionTicketInput.builder()
                    .ticketId(ticket.getId())
                    .toStatusId(targetStatusId)
                    .reason("Reorder across columns")
                    .build();
            doTransition(principal, transitionInput, TransitionSource.MANUAL);
            ticket = ticketRepository.findById(input.getId())
                    .orElseThrow(() -> new TicketNotFoundException(input.getId()));
        }

        // Overwrites the top-of-column rank the transition assigned: this caller knows the slot.
        ticket.setOrder(newOrder);
        Ticket saved = ticketRepository.save(ticket);
        log.info("Reordered ticket {} in column {} to order {}", saved.getId(), targetStatusId, newOrder);
        return saved;
    }

    public String computeRankAtTop(String statusId) {
        return ticketRepository.findFirstInColumnByStatusId(statusId, tenantIdProvider.getTenantId())
                .map(this::parseOrder)
                .map(LexoRank::genPrev)
                .orElseGet(LexoRank::middle)
                .format();
    }

    public String computeRankBetween(String afterTicketId, String beforeTicketId, String targetStatusId) {
        if (areBothNeighborsAbsent(afterTicketId, beforeTicketId)) {
            throw new IllegalArgumentException("afterTicketId or beforeTicketId must be specified");
        }

        if (areBothNeighborsPresent(afterTicketId, beforeTicketId)) {
            LexoRank lower = loadRank(afterTicketId, targetStatusId);
            LexoRank upper = loadRank(beforeTicketId, targetStatusId);
            // LexoRank throws on two equal ranks rather than picking a side, failing the drop
            // over data the user can neither see nor repair. Fall through to the single-anchor
            // path, which finds the opposite neighbour by a STRICT comparison and steps over
            // the tie. Ties cost nothing else: the cursor sort tie-breaks on `_id`.
            if (!lower.format().equals(upper.format())) {
                return lower.between(upper).format();
            }
            return rankAfterAnchor(lower, targetStatusId);
        }

        if (afterTicketId != null) {
            LexoRank anchor = loadRank(afterTicketId, targetStatusId);
            return rankAfterAnchor(anchor, targetStatusId);
        }

        LexoRank anchor = loadRank(beforeTicketId, targetStatusId);
        return rankBeforeAnchor(anchor, targetStatusId);
    }

    private String rankAfterAnchor(LexoRank anchor, String statusId) {
        return findRankAfter(statusId, anchor)
                .map(anchor::between)
                .orElseGet(anchor::genNext)
                .format();
    }

    private String rankBeforeAnchor(LexoRank anchor, String statusId) {
        return findRankBefore(statusId, anchor)
                .map(anchor::between)
                .orElseGet(anchor::genPrev)
                .format();
    }

    private boolean areBothNeighborsAbsent(String afterTicketId, String beforeTicketId) {
        return afterTicketId == null && beforeTicketId == null;
    }

    private boolean areBothNeighborsPresent(String afterTicketId, String beforeTicketId) {
        return afterTicketId != null && beforeTicketId != null;
    }

    private Optional<LexoRank> findRankAfter(String statusId, LexoRank anchor) {
        return ticketRepository.findFirstAfterByStatusId(statusId, anchor.format(), tenantIdProvider.getTenantId()).map(this::parseOrder);
    }

    private Optional<LexoRank> findRankBefore(String statusId, LexoRank anchor) {
        return ticketRepository.findFirstBeforeByStatusId(statusId, anchor.format(), tenantIdProvider.getTenantId()).map(this::parseOrder);
    }

    private LexoRank loadRank(String ticketId, String expectedStatusId) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Neighbor ticket not found: " + ticketId));
        if (isWrongStatus(ticket, expectedStatusId)) {
            throw new IllegalArgumentException(
                    "Neighbor " + ticketId + " is in statusId " + ticket.getStatusId()
                            + ", expected " + expectedStatusId);
        }
        return parseOrder(ticket);
    }

    private boolean isWrongStatus(Ticket ticket, String expectedStatusId) {
        return !expectedStatusId.equals(ticket.getStatusId());
    }

    private LexoRank parseOrder(Ticket ticket) {
        String order = ticket.getOrder();
        if (order == null) {
            throw new IllegalStateException("Ticket " + ticket.getId() + " has no order");
        }
        return LexoRank.parse(order);
    }

    private TransitionContext loadContext(String ticketId) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new TicketNotFoundException(ticketId));
        TicketStatusDefinition currentStatus = statusRepository
                .findById(ticket.getStatusId())
                .orElseThrow(() -> new IllegalStateException(
                        "Ticket " + ticketId + " has unknown statusId: " + ticket.getStatusId()));
        return new TransitionContext(ticket, currentStatus);
    }

    private void applyTransition(Ticket ticket, TicketStatusDefinition to) {
        ticket.setStatusId(to.getId());
        ticket.setStatusKind(to.getKind());
        if (isResolved(to)) {
            ticket.setResolvedAt(Instant.now());
        }
    }

    /**
     * Writes down who resolved the ticket — the assistant or a technician — so the record still
     * says it later, when the chat is long gone.
     */
    private void stampResolverIfResolved(Ticket ticket, TicketStatusDefinition target, AuthPrincipal principal) {
        if (!isResolved(target)) {
            return;
        }
        ticketResolverStamp.stamp(ticket, principal);
    }

    private boolean isResolved(TicketStatusDefinition status) {
        return status.getKind() == RESOLVED;
    }

    private boolean isSameStatus(TicketStatusDefinition from, TicketStatusDefinition to) {
        return from.getId() != null && from.getId().equals(to.getId());
    }

    /**
     * AI Handling belongs to the assistant: only automated flows (client reopen, escalation
     * plumbing) may move a ticket there — an admin/API transition gets the standard invalid-
     * transition error carrying the statuses that are actually allowed.
     */
    private void validateManualTransition(Ticket ticket, TicketStatusDefinition target, TransitionSource source) {
        if (source != TransitionSource.MANUAL || target.getKind() != AI_ASSISTANCE) {
            return;
        }
        List<String> allowedStatusIds = transitionPolicy.allowedNext(ticket).stream()
                .map(TicketStatusDefinition::getId)
                .toList();
        throw new InvalidTicketTransitionException(ticket.getStatusKind(), target.getKind(), allowedStatusIds);
    }

    private TicketQueryFilter buildArchiveFilter(String resolvedStatusId, TicketFilterInput filterInput) {
        TicketQueryFilter.TicketQueryFilterBuilder builder = TicketQueryFilter.builder()
                .statusIds(List.of(resolvedStatusId));
        if (filterInput != null) {
            builder.organizationIds(filterInput.getOrganizationIds())
                    .assigneeIds(filterInput.getAssigneeIds());
        }
        return builder.build();
    }

    @Builder
    private record TransitionContext(Ticket ticket, TicketStatusDefinition currentStatus) {
    }

    private enum TransitionSource {
        MANUAL,
        AUTOMATED
    }
}
