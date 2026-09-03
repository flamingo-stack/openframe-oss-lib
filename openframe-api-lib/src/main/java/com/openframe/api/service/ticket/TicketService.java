package com.openframe.api.service.ticket;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.ticket.CreateTicketInput;
import com.openframe.api.dto.ticket.ReorderTicketInput;
import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.api.dto.ticket.UpdateTicketInput;
import com.openframe.api.service.AssignmentService;
import com.openframe.api.service.ticket.spi.TicketEventListener;
import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.ticket.AdminTicketOwner;
import com.openframe.data.document.ticket.ClientTicketOwner;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketCreationSource;
import com.openframe.data.document.ticket.TicketOwner;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import com.openframe.data.document.user.User;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import static com.openframe.api.util.AuthPrincipalUtils.*;
import static org.springframework.util.StringUtils.hasText;

/**
 * Ticket domain core: querying, creation, field updates, assignment and the legacy (lifecycle-off)
 * status machine. Shared by the dashboard GraphQL API (AI Agent) and the external REST API; side
 * effects that belong to other subsystems are published through {@link TicketEventListener}.
 */
@Service
@Slf4j
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TicketService {

    public static final String ESCALATION_TRANSITION_REASON =
            "Escalated to a human technician at the user's request.";

    private final TicketRepository ticketRepository;
    private final TicketNumberService ticketNumberService;
    private final TicketTagService ticketTagService;
    private final TicketIdsForFilter ticketIdsForFilter;
    private final MachineRepository machineRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final AssignmentService assignmentService;
    private final TicketOrderCalculationService ticketOrderCalculationService;
    private final TicketLifecycleService ticketLifecycleService;
    private final TicketResolverStamp ticketResolverStamp;
    private final List<TicketEventListener> listeners;

    /**
     * Cursor-paginated ticket listing. Cursors are raw ticket ids. AGENT principals only see the
     * tickets owned by their machine.
     */
    public CountedGenericQueryResult<Ticket> getTickets(AuthPrincipal principal,
                                                        TicketFilterInput filter,
                                                        CursorPaginationCriteria pagination,
                                                        String search,
                                                        SortInput sort) {
        String ownerMachineId = isAgent(principal) ? principal.getMachineId() : null;

        log.debug("Querying tickets for {} with filter: {}, pagination: {}, search: '{}', sort: {}",
                principal.getActorType(), filter, pagination, search, sort);

        CursorPaginationCriteria paging = (pagination != null ? pagination : new CursorPaginationCriteria()).normalize();
        Query query = buildTicketQuery(principal, filter, search, ownerMachineId);
        long filteredCount = ticketRepository.countTickets(query);

        String sortField = validateSortField(sort);
        String sortDirection = sort != null && sort.getDirection() != null
                ? sort.getDirection().name()
                : SortDirection.DESC.name();
        List<Ticket> pageItems = fetchPageItems(query, paging, sortField, sortDirection);
        boolean hasNextPage = pageItems.size() == paging.getLimit();

        return CountedGenericQueryResult.<Ticket>builder()
                .items(pageItems)
                .pageInfo(buildPageInfo(pageItems, hasNextPage, paging.hasCursor()))
                .filteredCount((int) filteredCount)
                .build();
    }

    public Optional<Ticket> getTicket(AuthPrincipal principal, @NotBlank String ticketId) {
        log.debug("Getting ticket: {} for {}", ticketId, principal.getActorType());

        if (isAgent(principal)) {
            return ticketRepository.findByIdAndOwnerMachineId(ticketId, principal.getMachineId());
        }
        return ticketRepository.findById(ticketId);
    }

    @Transactional
    public Ticket createTicket(AuthPrincipal principal, CreateTicketInput input) {
        log.info("Creating ticket by {} {}", principal.getActorType(), principal.getDisplayName());

        boolean isAgentCreated = isAgent(principal);

        Ticket ticket = Ticket.builder()
                .ticketNumber(ticketNumberService.getNextTicketNumber())
                .title(input.getTitle())
                .description(input.getDescription())
                .status(isAgentCreated ? TicketStatus.TECH_REQUIRED : TicketStatus.ACTIVE)
                .creationSource(isAgentCreated ? TicketCreationSource.FAE_FORM : TicketCreationSource.ADMIN_DASHBOARD)
                .owner(buildTicketOwner(principal))
                .build();

        if (isAgentCreated) {
            populateDeviceFromPrincipal(ticket, principal);
            applyInitialStatusIfLifecycle(ticket);
        } else {
            populateAdminFields(ticket, input);
            // Manually (admin) created tickets pick a custom status (default: first custom),
            // never AI_ASSISTANCE which is reserved for the AI assistant.
            applyManualStatusIfLifecycle(ticket, input.getStatusId());
        }

        ticket.setOrder(computeTopOrder(ticket));

        Ticket savedTicket = ticketRepository.save(ticket);
        log.info("Created ticket #{} with ID: {}", savedTicket.getTicketNumber(), savedTicket.getId());

        if (isAdmin(principal)) {
            String ticketId = savedTicket.getId();
            ticketTagService.createTagAssignments(savedTicket.getId(), input.getTagIds());
            createAssignments(ticketId, AssignmentTargetType.ORGANIZATION, input.getAssignedOrganizationIds());
            createAssignments(ticketId, AssignmentTargetType.DEVICE, input.getAssignedDeviceIds());
            createAssignments(ticketId, AssignmentTargetType.TICKET, input.getAssignedTicketIds());
            createAssignments(ticketId, AssignmentTargetType.KNOWLEDGE_ARTICLE, input.getAssignedKnowledgeArticleIds());
        }

        listeners.forEach(listener -> listener.onTicketCreated(savedTicket, input, principal));
        return savedTicket;
    }

    /**
     * Creates a ticket for a client conversation started without a form. Title is null initially
     * (set later by the conversational layer) and status is ACTIVE because the AI handles it.
     */
    @Transactional
    public Ticket createTicketFromDialog(AuthPrincipal principal) {
        log.info("Creating ticket from dialog for {}", principal.getDisplayName());

        Ticket ticket = Ticket.builder()
                .ticketNumber(ticketNumberService.getNextTicketNumber())
                .status(TicketStatus.ACTIVE)
                .creationSource(TicketCreationSource.FAE_DIALOG)
                .owner(buildTicketOwner(principal))
                .build();

        populateDeviceFromPrincipal(ticket, principal);
        applyInitialStatusIfLifecycle(ticket);

        ticket.setOrder(computeTopOrder(ticket));

        Ticket savedTicket = ticketRepository.save(ticket);
        log.info("Created ticket #{} from dialog", savedTicket.getTicketNumber());

        return savedTicket;
    }

    /**
     * Creates a dialog-originated escalation ticket already in the TECH_REQUIRED bucket.
     * Stamps FAE_DIALOG provenance and applies the lifecycle status when enabled.
     */
    @Transactional
    public Ticket createEscalationTicket(AuthPrincipal principal, String title, String description) {
        log.info("Creating escalation ticket from dialog for {}", principal.getDisplayName());

        Ticket ticket = Ticket.builder()
                .ticketNumber(ticketNumberService.getNextTicketNumber())
                .title(title)
                .description(description)
                .status(TicketStatus.TECH_REQUIRED)
                .creationSource(TicketCreationSource.FAE_DIALOG)
                .owner(buildTicketOwner(principal))
                .build();

        populateDeviceFromPrincipal(ticket, principal);
        applyInitialStatusIfLifecycle(ticket);

        ticket.setOrder(computeTopOrder(ticket));

        Ticket savedTicket = ticketRepository.save(ticket);
        log.info("Created escalation ticket #{}", savedTicket.getTicketNumber());

        return savedTicket;
    }

    /**
     * Moves the dialog's existing ticket into TECH_REQUIRED, returning empty when it cannot legally get
     * there so the caller opens a fresh ticket. On lifecycle-off tenants the move is applied by the
     * dialog status sync; on lifecycle-on tenants only an AI_ASSISTANCE ticket may transition (an
     * already-TECH_REQUIRED one is a no-op).
     *
     * <p>The escalated ticket lands at the top of its new column; that re-ranking belongs to
     * the transition itself, so this no longer does it here.
     */
    @Transactional
    public Optional<Ticket> moveExistingTicketToTechRequired(AuthPrincipal principal, Ticket ticket, String reason) {
        TicketStatusKind currentKind = ticket.getStatusKind();
        if (currentKind == TicketStatusKind.TECH_REQUIRED) {
            return Optional.of(ticket);
        }
        if (currentKind != TicketStatusKind.AI_ASSISTANCE) {
            return Optional.empty();
        }
        return Optional.of(ticketLifecycleService.transitionToKind(
                principal, ticket.getId(), TicketStatusKind.TECH_REQUIRED, reason));
    }

    @Transactional
    public Ticket updateTicket(AuthPrincipal principal, @NotBlank String ticketId, UpdateTicketInput input) {
        validateAdminAccess(principal);
        log.info("Updating ticket {} by user: {}", ticketId, principal.getDisplayName());

        Ticket ticket = getById(ticketId);

        if (input.getTitle() != null) {
            ticket.setTitle(input.getTitle());
        }
        if (input.getDescription() != null) {
            ticket.setDescription(input.getDescription());
        }
        if (input.getDeviceId() != null || input.getOrganizationId() != null) {
            populateDeviceAndOrganization(ticket, input.getDeviceId(), input.getOrganizationId());
        }
        if (input.getAssigneeId() != null) {
            populateAssignee(ticket, input.getAssigneeId());
        }

        Ticket savedTicket = ticketRepository.save(ticket);

        ticketTagService.syncTagAssignments(savedTicket.getId(), input.getTagIds());

        listeners.forEach(listener -> listener.onTicketUpdated(savedTicket, input, principal));
        return savedTicket;
    }

    @Transactional
    public Ticket assignTicket(AuthPrincipal principal, @NotBlank String ticketId, @NotBlank String assigneeId) {
        validateAdminAccess(principal);
        log.info("Assigning ticket {} to user {} by: {}", ticketId, assigneeId, principal.getDisplayName());

        Ticket ticket = getById(ticketId);
        populateAssignee(ticket, assigneeId);
        Ticket savedTicket = ticketRepository.save(ticket);
        listeners.forEach(listener -> listener.onTicketAssigned(savedTicket, principal));
        return savedTicket;
    }

    @Transactional
    public void autoAssignToSelfIfUnassigned(AuthPrincipal principal, @NotBlank String ticketId) {
        validateAdminAccess(principal);

        Ticket ticket = getById(ticketId);
        if (hasAssignee(ticket)) {
            log.debug("Ticket {} already assigned to {} — skipping auto-assign on direct chat start",
                    ticketId, ticket.getAssignedTo());
            return;
        }

        String adminId = principal.getId();
        populateAssignee(ticket, adminId);
        ticketRepository.save(ticket);
        log.info("Auto-assigned ticket {} to admin {} on direct chat start", ticketId, adminId);
    }

    @Transactional
    public Ticket unassignTicket(AuthPrincipal principal, @NotBlank String ticketId) {
        validateAdminAccess(principal);
        log.info("Unassigning ticket {} by: {}", ticketId, principal.getDisplayName());

        Ticket ticket = getById(ticketId);
        ticket.setAssignedTo(null);
        ticket.setAssignedName(null);

        return ticketRepository.save(ticket);
    }

    @Transactional
    public Ticket unlinkDeviceFromTicket(AuthPrincipal principal, @NotBlank String ticketId) {
        validateAdminAccess(principal);
        log.info("Unlinking device from ticket {} by: {}", ticketId, principal.getDisplayName());

        Ticket ticket = getById(ticketId);
        ticket.setDeviceId(null);
        ticket.setDeviceHostname(null);

        return ticketRepository.save(ticket);
    }

    @Transactional
    public Ticket unlinkOrganizationFromTicket(AuthPrincipal principal, @NotBlank String ticketId) {
        validateAdminAccess(principal);
        log.info("Unlinking organization from ticket {} by: {}", ticketId, principal.getDisplayName());

        Ticket ticket = getById(ticketId);
        ticket.setOrganizationId(null);
        ticket.setOrganizationName(null);
        // Cascade: device cannot exist without organization
        ticket.setDeviceId(null);
        ticket.setDeviceHostname(null);

        return ticketRepository.save(ticket);
    }

    // TODO(lifecycle-rollout): drop legacy per-status mutations (putOnHold/resolve/archive/reopen) once clients use transitionTicket
    @Transactional
    public Ticket putTicketOnHold(AuthPrincipal principal, @NotBlank String ticketId) {
        validateAdminAccess(principal);
        ensureLegacyStatusMutationAllowed();
        log.info("Putting ticket {} on hold by: {}", ticketId, principal.getDisplayName());

        Ticket ticket = getById(ticketId);
        TicketStatus previousStatus = ticket.getStatus();
        validateTransition(ticket, TicketStatus.ON_HOLD);
        ticket.setStatus(TicketStatus.ON_HOLD);

        Ticket saved = ticketRepository.save(ticket);
        notifyLegacyStatusChanged(saved, previousStatus, principal);
        return saved;
    }

    @Transactional
    public Ticket resolveTicket(AuthPrincipal principal, @NotBlank String ticketId) {
        validateAdminAccess(principal);
        ensureLegacyStatusMutationAllowed();
        log.info("Resolving ticket {} by: {}", ticketId, principal.getDisplayName());

        Ticket ticket = getById(ticketId);
        TicketStatus previousStatus = ticket.getStatus();
        validateTransition(ticket, TicketStatus.RESOLVED);
        ticket.setStatus(TicketStatus.RESOLVED);
        ticket.setResolvedAt(Instant.now());
        ticketResolverStamp.stamp(ticket, principal);

        Ticket saved = ticketRepository.save(ticket);
        notifyLegacyStatusChanged(saved, previousStatus, principal);
        return saved;
    }

    @Transactional
    public Ticket archiveTicket(AuthPrincipal principal, @NotBlank String ticketId) {
        validateAdminAccess(principal);
        ensureLegacyStatusMutationAllowed();
        log.info("Archiving ticket {} by: {}", ticketId, principal.getDisplayName());

        Ticket ticket = getById(ticketId);
        TicketStatus previousStatus = ticket.getStatus();
        validateTransition(ticket, TicketStatus.ARCHIVED);
        ticket.setStatus(TicketStatus.ARCHIVED);

        Ticket saved = ticketRepository.save(ticket);
        notifyLegacyStatusChanged(saved, previousStatus, principal);
        return saved;
    }

    @Transactional
    public Ticket reopenTicket(AuthPrincipal principal, @NotBlank String ticketId) {
        validateAdminAccess(principal);
        ensureLegacyStatusMutationAllowed();
        log.info("Reopening ticket {} by: {}", ticketId, principal.getDisplayName());

        Ticket ticket = getById(ticketId);
        TicketStatus previousStatus = ticket.getStatus();
        validateTransition(ticket, TicketStatus.RESOLVED);
        ticket.setStatus(TicketStatus.RESOLVED);

        Ticket saved = ticketRepository.save(ticket);
        notifyLegacyStatusChanged(saved, previousStatus, principal);
        return saved;
    }

    @Transactional
    public Ticket reorderTicket(AuthPrincipal principal, ReorderTicketInput input) {
        validateAdminAccess(principal);

        // TODO(lifecycle-rollout): drop the legacy body below once clients always send statusId
        if (input.getStatusId() != null) {
            return ticketLifecycleService.reorderTicket(principal, input);
        }

        String ticketId = input.getId();
        String afterTicketId = input.getAfterTicketId();
        String beforeTicketId = input.getBeforeTicketId();
        TicketStatus requestedStatus = input.getStatus();
        String user = principal.getDisplayName();

        log.info("Reordering ticket {} after={}, before={}, status={} by: {}",
                ticketId, afterTicketId, beforeTicketId, requestedStatus, user);

        Ticket ticket = getById(ticketId);
        TicketStatus previousStatus = ticket.getStatus();

        boolean isStatusChanged = isStatusChanged(ticket, requestedStatus);
        if (isStatusChanged) {
            applyStatusChange(ticket, requestedStatus);
        }

        TicketStatus columnStatus = ticket.getStatus();
        String newOrder = ticketOrderCalculationService.computeRankBetween(afterTicketId, beforeTicketId, columnStatus);
        ticket.setOrder(newOrder);

        Ticket saved = ticketRepository.save(ticket);
        if (isStatusChanged) {
            notifyLegacyStatusChanged(saved, previousStatus, principal);
        }

        return saved;
    }

    /**
     * Mirrors an externally-driven legacy status (e.g. the client conversation's status) onto the
     * ticket. Idempotent; skips ARCHIVED; bypasses auth and transition rules.
     */
    @Transactional
    // TODO(lifecycle-rollout): drop together with the dialog→ticket status sync after rollout
    public void syncLegacyStatus(@NotBlank String ticketId, TicketStatus target) {
        Ticket ticket = ticketRepository.findById(ticketId).orElse(null);
        if (ticket == null) {
            log.debug("syncLegacyStatus: ticket not found, id={}", ticketId);
            return;
        }
        TicketStatus current = ticket.getStatus();
        if (current == TicketStatus.ARCHIVED) {
            return;
        }
        if (target == null || current == target) {
            return;
        }
        log.info("Syncing ticket {} status {} → {}", ticketId, current, target);
        ticket.setStatus(target);
        if (target == TicketStatus.RESOLVED) {
            ticket.setResolvedAt(Instant.now());
        } else if (target == TicketStatus.ACTIVE) {
            ticket.setResolvedAt(null);
        }
        ticketRepository.save(ticket);
    }

    @Transactional
    public int archiveResolvedTickets(AuthPrincipal principal, TicketFilterInput filter) {
        validateAdminAccess(principal);
        log.info("Archiving resolved tickets by: {}, filter: {}", principal.getDisplayName(), filter);

        List<String> archivedIds = ticketLifecycleService.archiveResolvedTickets(principal, filter);
        listeners.forEach(listener -> listener.onTicketsArchived(archivedIds, principal));
        log.info("Archived {} resolved tickets", archivedIds.size());
        return archivedIds.size();
    }

    // ---------- internals ----------

    private void notifyLegacyStatusChanged(Ticket saved, TicketStatus previousStatus, AuthPrincipal principal) {
        listeners.forEach(listener -> listener.onLegacyStatusChanged(saved, previousStatus, principal));
    }

    // Columns are grouped by statusId, so a new ticket's top rank is computed against its statusId
    // column. Requires the lifecycle status to be applied beforehand.
    private String computeTopOrder(Ticket ticket) {
        return ticketLifecycleService.computeRankAtTop(ticket.getStatusId());
    }

    private void applyInitialStatusIfLifecycle(Ticket ticket) {
        ticketLifecycleService.applyInitialStatus(ticket);
    }

    private void applyManualStatusIfLifecycle(Ticket ticket, String requestedStatusId) {
        ticketLifecycleService.applyManualInitialStatus(ticket, requestedStatusId);
    }

    // Custom statuses are authoritative and transitions must go through transitionTicket;
    // the legacy enum-based mutations would silently desync statusId/statusKind.
    private void ensureLegacyStatusMutationAllowed() {
        throw new IllegalStateException(
                "Legacy status mutations are disabled while ticket lifecycle is enabled; use transitionTicket");
    }

    private boolean isStatusChanged(Ticket ticket, TicketStatus targetTicketStatus) {
        if (targetTicketStatus == null) {
            return false;
        }
        return targetTicketStatus != ticket.getStatus();
    }

    private void applyStatusChange(Ticket ticket, TicketStatus target) {
        validateTransition(ticket, target);
        ticket.setStatus(target);
        if (target == TicketStatus.RESOLVED) {
            ticket.setResolvedAt(Instant.now());
        } else if (target != TicketStatus.ARCHIVED) {
            ticket.setResolvedAt(null);
        }
    }

    private void validateTransition(Ticket ticket, TicketStatus targetStatus) {
        if (!ticket.getStatus().canTransitionTo(targetStatus)) {
            throw new IllegalStateException(
                    "Invalid status transition: " + ticket.getStatus() + " → " + targetStatus);
        }
    }

    private Ticket getById(String ticketId) {
        return ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketId));
    }

    private TicketOwner buildTicketOwner(AuthPrincipal principal) {
        return switch (principal.getActorType()) {
            case AGENT -> new ClientTicketOwner(principal.getMachineId());
            case ADMIN -> new AdminTicketOwner(principal.getId());
        };
    }

    private Query buildTicketQuery(AuthPrincipal principal, TicketFilterInput filter,
                                   String search, String ownerMachineId) {
        TicketQueryFilter queryFilter = toQueryFilter(filter);
        List<String> restrictToTicketIds = ticketIdsForFilter.resolve(principal, filter);
        return ticketRepository.buildTicketQuery(queryFilter, search, restrictToTicketIds, ownerMachineId);
    }

    private TicketQueryFilter toQueryFilter(TicketFilterInput filter) {
        if (filter == null) {
            return new TicketQueryFilter();
        }
        return TicketQueryFilter.builder()
                .statuses(filter.getStatuses())
                .statusIds(filter.getStatusIds())
                .organizationIds(filter.getOrganizationIds())
                .assigneeIds(filter.getAssigneeIds())
                .build();
    }

    private List<Ticket> fetchPageItems(Query query, CursorPaginationCriteria criteria,
                                        String sortField, String sortDirection) {
        List<Ticket> tickets = ticketRepository.findTicketsWithCursor(
                query, criteria.getCursor(), criteria.getLimit() + 1, sortField, sortDirection);
        return tickets.size() > criteria.getLimit()
                ? tickets.subList(0, criteria.getLimit())
                : tickets;
    }

    private PageInfo buildPageInfo(List<Ticket> pageItems, boolean hasNextPage, boolean hasPreviousPage) {
        String startCursor = pageItems.isEmpty() ? null : pageItems.getFirst().getId();
        String endCursor = pageItems.isEmpty() ? null : pageItems.getLast().getId();

        return PageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(hasPreviousPage)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }

    private String validateSortField(SortInput sort) {
        String field = sort != null ? sort.getField() : null;
        if (field == null || field.trim().isEmpty()) {
            return ticketRepository.getDefaultSortField();
        }
        String trimmedField = field.trim();
        if (!ticketRepository.isSortableField(trimmedField)) {
            log.warn("Invalid sort field requested: {}, using default", field);
            return ticketRepository.getDefaultSortField();
        }
        return trimmedField;
    }

    private void populateDeviceFromPrincipal(Ticket ticket, AuthPrincipal principal) {
        String machineId = principal.getMachineId();
        if (machineId == null || machineId.isBlank()) {
            log.warn("AGENT token missing machineId for ticket creation");
            return;
        }

        Machine device = requireMachine(machineId);
        ticket.setDeviceId(device.getMachineId());
        ticket.setDeviceHostname(device.getHostname());

        if (device.getOrganizationId() != null) {
            Organization org = requireOrganization(device.getOrganizationId());
            ticket.setOrganizationId(org.getOrganizationId());
            ticket.setOrganizationName(org.getName());
        }
        log.debug("Auto-populated device {} and org {} for AGENT ticket",
                device.getHostname(), ticket.getOrganizationName());
    }

    private void populateAdminFields(Ticket ticket, CreateTicketInput input) {
        populateDeviceAndOrganization(ticket, input.getDeviceId(), input.getOrganizationId());

        if (input.getAssigneeId() != null) {
            populateAssignee(ticket, input.getAssigneeId());
        }
    }

    private void populateDeviceAndOrganization(Ticket ticket, String deviceId, String organizationId) {
        String resolvedOrgId = organizationId;
        if (deviceId != null) {
            Machine device = requireMachine(deviceId);
            ticket.setDeviceId(device.getMachineId());
            ticket.setDeviceHostname(device.getHostname());
            if (resolvedOrgId == null) {
                resolvedOrgId = device.getOrganizationId();
            } else if (!resolvedOrgId.equals(device.getOrganizationId())) {
                throw new IllegalArgumentException("Device doesn't belong to selected organization");
            }
        }

        if (resolvedOrgId != null) {
            Organization org = requireOrganization(resolvedOrgId);
            ticket.setOrganizationId(org.getOrganizationId());
            ticket.setOrganizationName(org.getName());
        }
    }

    private void populateAssignee(Ticket ticket, String assigneeId) {
        User user = userRepository.findById(assigneeId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + assigneeId));
        ticket.setAssignedTo(user.getId());
        ticket.setAssignedName(TicketUserNames.displayName(user));
    }

    private Machine requireMachine(String machineId) {
        return machineRepository.findByMachineId(machineId)
                .orElseThrow(() -> new IllegalArgumentException("Device not found by machineId: " + machineId));
    }

    private Organization requireOrganization(String organizationId) {
        return organizationRepository.findByOrganizationId(organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found by organizationId: " + organizationId));
    }

    private boolean hasAssignee(Ticket ticket) {
        return hasText(ticket.getAssignedTo());
    }

    private void createAssignments(String ticketId, AssignmentTargetType targetType, List<String> targetIds) {
        if (targetIds == null || targetIds.isEmpty()) {
            return;
        }
        targetIds.forEach(targetId -> assignmentService.assignItem(ticketId, AssignmentItemType.TICKET, targetType, targetId));
    }
}
