package com.openframe.api.service.ticket;

import com.github.pravin.raha.lexorank4j.LexoRank;
import com.openframe.api.dto.ticket.CreateTicketStatusInput;
import com.openframe.api.dto.ticket.DeleteTicketStatusInput;
import com.openframe.api.dto.ticket.ReorderTicketStatusInput;
import com.openframe.api.dto.ticket.UpdateTicketStatusInput;
import com.openframe.api.exception.ticket.DuplicateTicketStatusNameException;
import com.openframe.api.exception.ticket.InvalidTicketStatusReorderException;
import com.openframe.api.exception.ticket.InvalidTicketStatusReplacementException;
import com.openframe.api.exception.ticket.SystemTicketStatusModificationException;
import com.openframe.api.exception.ticket.TicketStatusInUseException;
import com.openframe.api.exception.ticket.TicketStatusNotFoundException;
import com.openframe.api.exception.ticket.TicketStatusOperation;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.ticket.TicketStatusDefinitionRepository;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.util.List;
import java.util.Optional;

import static com.openframe.api.exception.ticket.TicketStatusOperation.*;
import static com.openframe.api.util.AuthPrincipalUtils.validateAdminAccess;
import static com.openframe.data.document.ticket.TicketStatusKind.*;

/**
 * Tenant ticket status definitions: the seeded system statuses plus custom ones managed by admins.
 */
@Service
@Slf4j
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TicketStatusService {

    private final TicketStatusDefinitionRepository statusRepository;
    private final TicketRepository ticketRepository;
    private final TicketTransitionPolicyValidator transitionPolicy;

    public List<TicketStatusDefinition> list() {
        return statusRepository.findAllByOrderByPositionAsc();
    }

    @Transactional
    public TicketStatusDefinition create(AuthPrincipal principal, @Valid CreateTicketStatusInput input) {
        validateAdminAccess(principal);
        ensureUniqueName(input.getName());

        TicketStatusDefinition definition = TicketStatusDefinition.builder()
                .kind(CUSTOM)
                .name(input.getName())
                .color(input.getColor())
                .position(nextCustomPosition())
                .staleAfterMinutes(input.getStaleAfterMinutes())
                .build();

        TicketStatusDefinition saved = statusRepository.save(definition);
        log.info("Created custom status {} (id={})", saved.getName(), saved.getId());
        return saved;
    }

    @Transactional
    public TicketStatusDefinition update(AuthPrincipal principal, @Valid UpdateTicketStatusInput input) {
        validateAdminAccess(principal);
        TicketStatusDefinition status = requireStatus(input.getId());

        applyName(status, input.getName());
        applyColor(status, input.getColor());
        applyStaleAfterMinutes(status, input.getStaleAfterMinutes());

        return statusRepository.save(status);
    }

    @Transactional
    public boolean delete(AuthPrincipal principal, @Valid DeleteTicketStatusInput input) {
        validateAdminAccess(principal);
        TicketStatusDefinition status = requireStatus(input.getId());
        ensureCustomStatus(status, DELETE);

        long inUseCount = ticketRepository.countByStatusId(status.getId());
        if (inUseCount > 0) {
            deleteWithReplacement(status, input.getReplacementStatusId(), inUseCount);
            return true;
        }

        statusRepository.delete(status);
        log.info("Deleted custom status {}", status.getId());
        return true;
    }

    @Transactional
    public TicketStatusDefinition reorder(AuthPrincipal principal, @Valid ReorderTicketStatusInput input) {
        validateAdminAccess(principal);
        TicketStatusDefinition status = requireStatus(input.getId());
        ensureCustomStatus(status, REORDER);

        String newPosition = computePosition(input.getId(), input.getAfterStatusId(), input.getBeforeStatusId());
        status.setPosition(newPosition);
        TicketStatusDefinition saved = statusRepository.save(status);
        log.info("Reordered custom status {} to position {}", saved.getId(), newPosition);
        return saved;
    }

    private void ensureUniqueName(String name) {
        if (statusRepository.existsByName(name)) {
            throw new DuplicateTicketStatusNameException(name);
        }
    }

    private String nextCustomPosition() {
        LexoRank resolvedRank = loadSystemRank(RESOLVED);
        List<TicketStatusDefinition> customs = statusRepository.findByKindOrderByPositionAsc(CUSTOM);
        LexoRank leftBound = customs.isEmpty()
                ? loadSystemRank(TECH_REQUIRED)
                : LexoRank.parse(customs.getLast().getPosition());
        return leftBound.between(resolvedRank).format();
    }

    private String computePosition(String movingId, String afterId, String beforeId) {
        if (afterId == null && beforeId == null) {
            throw new InvalidTicketStatusReorderException("afterStatusId or beforeStatusId must be specified");
        }
        if (movingId.equals(afterId) || movingId.equals(beforeId)) {
            throw new InvalidTicketStatusReorderException("Cannot reorder a status relative to itself");
        }
        if (afterId != null && beforeId != null) {
            LexoRank lower = loadCustomRank(afterId);
            LexoRank upper = loadCustomRank(beforeId);
            return lower.between(upper).format();
        }
        if (afterId != null) {
            LexoRank anchor = loadCustomRank(afterId);
            return rankAfterCustomAnchor(anchor, movingId).format();
        }
        LexoRank anchor = loadCustomRank(beforeId);
        return rankBeforeCustomAnchor(anchor, movingId).format();
    }

    private LexoRank rankAfterCustomAnchor(LexoRank anchor, String excludeId) {
        return findFirstCustomAfter(anchor, excludeId)
                .map(anchor::between)
                .orElseGet(() -> anchor.between(loadSystemRank(RESOLVED)));
    }

    private LexoRank rankBeforeCustomAnchor(LexoRank anchor, String excludeId) {
        return findFirstCustomBefore(anchor, excludeId)
                .map(neighbor -> neighbor.between(anchor))
                .orElseGet(() -> loadSystemRank(TECH_REQUIRED).between(anchor));
    }

    private Optional<LexoRank> findFirstCustomAfter(LexoRank anchor, String excludeId) {
        String anchorPosition = anchor.format();
        return statusRepository.findByKindOrderByPositionAsc(CUSTOM).stream()
                .filter(s -> !s.getId().equals(excludeId))
                .filter(s -> s.getPosition().compareTo(anchorPosition) > 0)
                .findFirst()
                .map(s -> LexoRank.parse(s.getPosition()));
    }

    private Optional<LexoRank> findFirstCustomBefore(LexoRank anchor, String excludeId) {
        String anchorPosition = anchor.format();
        return statusRepository.findByKindOrderByPositionAsc(CUSTOM).stream()
                .filter(s -> !s.getId().equals(excludeId))
                .filter(s -> s.getPosition().compareTo(anchorPosition) < 0)
                .reduce((first, second) -> second)
                .map(s -> LexoRank.parse(s.getPosition()));
    }

    private LexoRank loadCustomRank(String id) {
        TicketStatusDefinition status = requireStatus(id);
        if (status.getKind() != CUSTOM) {
            throw new InvalidTicketStatusReorderException("Neighbor must be a custom status: " + id);
        }
        return LexoRank.parse(status.getPosition());
    }

    private LexoRank loadSystemRank(TicketStatusKind kind) {
        return statusRepository.findByKind(kind)
                .map(s -> LexoRank.parse(s.getPosition()))
                .orElseThrow(() -> new IllegalStateException("System status " + kind + " missing"));
    }

    private void applyName(TicketStatusDefinition status, String name) {
        if (name == null || name.equals(status.getName())) {
            return;
        }
        ensureCustomStatus(status, RENAME);
        ensureUniqueName(name);
        status.setName(name);
    }

    private void applyColor(TicketStatusDefinition status, String color) {
        if (color == null || color.equals(status.getColor())) {
            return;
        }
        ensureCustomStatus(status, CHANGE_COLOR);
        status.setColor(color);
    }

    // Only an explicit value changes the threshold; null leaves the status on the deployment default,
    // which is also how a status that never set one behaves.
    private void applyStaleAfterMinutes(TicketStatusDefinition status, Integer staleAfterMinutes) {
        if (staleAfterMinutes != null) {
            status.setStaleAfterMinutes(staleAfterMinutes);
        }
    }

    private void ensureCustomStatus(TicketStatusDefinition status, TicketStatusOperation operation) {
        if (status.getKind().isSystem()) {
            throw new SystemTicketStatusModificationException(status.getId(), operation);
        }
    }

    private void ensureValidReplacement(TicketStatusDefinition status, TicketStatusDefinition replacement) {
        if (replacement.getKind() == null
                || !transitionPolicy.allowedKinds(CUSTOM).contains(replacement.getKind())) {
            throw InvalidTicketStatusReplacementException.notAllowedTarget(status.getId(), replacement.getId());
        }
    }

    private void deleteWithReplacement(TicketStatusDefinition status,
                                       String replacementStatusId,
                                       long inUseCount) {
        if (replacementStatusId == null) {
            throw new TicketStatusInUseException(status.getId(), inUseCount);
        }
        if (status.getId().equals(replacementStatusId)) {
            throw InvalidTicketStatusReplacementException.sameStatus(status.getId(), replacementStatusId);
        }
        TicketStatusDefinition replacement = requireStatus(replacementStatusId);
        ensureValidReplacement(status, replacement);

        int reassigned = ticketRepository.reassignTicketsToStatus(
                status.getId(), replacement.getId(), replacement.getKind());
        statusRepository.delete(status);
        log.info("Deleted custom status {} with {} tickets reassigned to {}",
                status.getId(), reassigned, replacement.getId());
    }

    private TicketStatusDefinition requireStatus(String id) {
        return statusRepository.findById(id)
                .orElseThrow(() -> new TicketStatusNotFoundException(id));
    }
}
