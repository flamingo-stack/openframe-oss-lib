package com.openframe.api.service.ticket;

import com.openframe.api.exception.ticket.TicketNotFoundException;
import com.openframe.audit.AuditRecorder;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.validation.annotation.Validated;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import static com.openframe.api.util.AuthPrincipalUtils.validateAdminAccess;
import static com.openframe.data.document.audit.AuditAction.TICKET_TAG_ADD;
import static com.openframe.data.document.audit.AuditAction.TICKET_TAG_REMOVE;
import static com.openframe.data.document.audit.AuditTargetType.TICKET;

@Service
@Slf4j
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TicketTagService {

    private final TagRepository tagRepository;
    private final TagAssignmentRepository tagAssignmentRepository;
    private final TicketRepository ticketRepository;
    private final AuditRecorder auditRecorder;
    private final AuditedMethodRunner auditedMethodRunner;

    public List<Tag> getTags(AuthPrincipal principal) {
        validateAdminAccess(principal);
        return tagRepository.findByEntityType(TagEntityType.TICKET);
    }

    public List<Tag> getTags() {
        return tagRepository.findByEntityType(TagEntityType.TICKET);
    }

    /** One page of ticket tags, oldest first: from the start when afterTagId is null, otherwise after that tag. */
    public List<Tag> getTagsPage(AuthPrincipal principal, String afterTagId, int limit) {
        validateAdminAccess(principal);
        Limit page = Limit.of(limit);
        if (afterTagId == null) {
            return tagRepository.findByEntityTypeOrderByIdAsc(TagEntityType.TICKET, page);
        }
        return tagRepository.findByEntityTypeAndIdGreaterThanOrderByIdAsc(TagEntityType.TICKET, afterTagId, page);
    }

    @Transactional
    public boolean addTagToTicket(AuthPrincipal principal, @NotBlank String ticketId, @NotBlank String tagId) {
        return auditedMethodRunner.runWhenChanged(TICKET_TAG_ADD, TICKET, ticketId, tagDetails(tagId),
                () -> assignTag(principal, ticketId, tagId));
    }

    private boolean assignTag(AuthPrincipal principal, String ticketId, String tagId) {
        validateAdminAccess(principal);
        validateTicketExists(ticketId);
        log.info("Adding tag {} to ticket {} by: {}", tagId, ticketId, principal.getDisplayName());
        if (isAssigned(ticketId, tagId)) {
            return false;
        }
        TagAssignment assignment = TagAssignment.builder()
                .entityId(ticketId)
                .tagId(tagId)
                .entityType(TagEntityType.TICKET)
                .build();
        tagAssignmentRepository.save(assignment);
        return true;
    }

    @Transactional
    public boolean removeTagFromTicket(AuthPrincipal principal, @NotBlank String ticketId, @NotBlank String tagId) {
        return auditedMethodRunner.runWhenChanged(TICKET_TAG_REMOVE, TICKET, ticketId, tagDetails(tagId),
                () -> unassignTag(principal, ticketId, tagId));
    }

    private Map<String, Object> tagDetails(String tagId) {
        Map<String, Object> details = new HashMap<>(Map.of("tagIds", List.of(tagId)));
        tagRepository.findById(tagId).ifPresent(tag -> details.put("tagKeys", List.of(tag.getKey())));
        return details;
    }

    private boolean unassignTag(AuthPrincipal principal, String ticketId, String tagId) {
        validateAdminAccess(principal);
        validateTicketExists(ticketId);
        log.info("Removing tag {} from ticket {} by: {}", tagId, ticketId, principal.getDisplayName());
        boolean assigned = isAssigned(ticketId, tagId);
        tagAssignmentRepository.deleteByEntityIdAndTagIdAndEntityType(ticketId, tagId, TagEntityType.TICKET);
        return assigned;
    }

    private boolean isAssigned(String ticketId, String tagId) {
        return tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(ticketId, tagId, TagEntityType.TICKET)
                .isPresent();
    }

    @Transactional
    public void createTagAssignments(String ticketId, List<String> tagIds) {
        if (CollectionUtils.isEmpty(tagIds)) {
            return;
        }
        List<String> distinctIds = tagIds.stream().distinct().toList();
        log.debug("Creating {} tag assignments for ticket {}", distinctIds.size(), ticketId);
        List<TagAssignment> assignments = distinctIds.stream()
                .map(tagId -> TagAssignment.builder()
                        .entityId(ticketId)
                        .tagId(tagId)
                        .entityType(TagEntityType.TICKET)
                        .build())
                .toList();
        tagAssignmentRepository.saveAll(assignments);
        distinctIds.forEach(tagId -> recordTagChange(TICKET_TAG_ADD, ticketId, tagId));
    }

    @Transactional
    public void syncTagAssignments(String ticketId, List<String> tagIds) {
        if (tagIds == null) {
            return;
        }
        log.debug("Syncing tags for ticket {}: {}", ticketId, tagIds);
        List<String> distinctIds = tagIds.stream().distinct().toList();
        validateTagsExist(distinctIds);
        List<TagAssignment> currentAssignments = tagAssignmentRepository
                .findByEntityIdAndEntityType(ticketId, TagEntityType.TICKET);
        Set<String> currentTagIds = currentAssignments.stream()
                .map(TagAssignment::getTagId)
                .collect(Collectors.toSet());
        Set<String> newTagIds = new HashSet<>(distinctIds);
        List<String> removed = removeStaleAssignments(currentAssignments, newTagIds);
        List<String> added = addNewAssignments(ticketId, distinctIds, currentTagIds);
        removed.forEach(tagId -> recordTagChange(TICKET_TAG_REMOVE, ticketId, tagId));
        added.forEach(tagId -> recordTagChange(TICKET_TAG_ADD, ticketId, tagId));
    }

    private void recordTagChange(AuditAction action, String ticketId, String tagId) {
        auditRecorder.record(AuditEntry.builder()
                .action(action)
                .outcome(AuditOutcome.SUCCESS)
                .targetId(ticketId)
                .details(tagDetails(tagId))
                .build());
    }

    public List<String> getTicketIdsByTagIds(List<String> tagIds) {
        if (tagIds == null || tagIds.isEmpty()) {
            return List.of();
        }
        List<TagAssignment> assignments = tagAssignmentRepository
                .findByTagIdInAndEntityType(tagIds, TagEntityType.TICKET);
        return assignments.stream()
                .map(TagAssignment::getEntityId)
                .distinct()
                .toList();
    }

    public List<List<Tag>> getTagsByTicketIds(List<String> ticketIds) {
        log.debug("Batch loading tags for {} tickets", ticketIds.size());
        List<TagAssignment> assignments = tagAssignmentRepository
                .findByEntityIdInAndEntityType(ticketIds, TagEntityType.TICKET);
        List<String> tagIds = assignments.stream()
                .map(TagAssignment::getTagId)
                .distinct()
                .toList();
        Map<String, Tag> tagMap = tagRepository.findAllById(tagIds).stream()
                .collect(Collectors.toMap(Tag::getId, t -> t));
        Map<String, List<TagAssignment>> assignmentsByEntityId = assignments.stream()
                .collect(Collectors.groupingBy(TagAssignment::getEntityId));
        return ticketIds.stream()
                .map(ticketId -> {
                    List<TagAssignment> ticketAssignments = assignmentsByEntityId.getOrDefault(ticketId, List.of());
                    return ticketAssignments.stream()
                            .map(a -> tagMap.get(a.getTagId()))
                            .filter(Objects::nonNull)
                            .toList();
                })
                .toList();
    }

    private void validateTagsExist(List<String> tagIds) {
        if (tagIds.isEmpty()) {
            return;
        }
        Set<String> existingIds = tagRepository.findAllById(tagIds)
                .stream().map(Tag::getId).collect(Collectors.toSet());
        if (existingIds.size() != tagIds.size()) {
            List<String> notFound = tagIds.stream()
                    .filter(id -> !existingIds.contains(id))
                    .toList();
            throw new NotFoundException(ErrorCode.TAG_NOT_FOUND, "Tags not found: " + notFound);
        }
    }

    private List<String> removeStaleAssignments(List<TagAssignment> currentAssignments, Set<String> newTagIds) {
        List<TagAssignment> toRemove = currentAssignments.stream()
                .filter(a -> !newTagIds.contains(a.getTagId()))
                .toList();
        if (!toRemove.isEmpty()) {
            tagAssignmentRepository.deleteAll(toRemove);
            log.debug("Removed {} tags from ticket", toRemove.size());
        }
        return toRemove.stream().map(TagAssignment::getTagId).toList();
    }

    private List<String> addNewAssignments(String ticketId, List<String> tagIds, Set<String> currentTagIds) {
        List<String> toAdd = tagIds.stream()
                .filter(id -> !currentTagIds.contains(id))
                .toList();
        if (!toAdd.isEmpty()) {
            List<TagAssignment> newAssignments = toAdd.stream()
                    .map(tagId -> TagAssignment.builder()
                            .entityId(ticketId)
                            .tagId(tagId)
                            .entityType(TagEntityType.TICKET)
                            .build())
                    .toList();
            tagAssignmentRepository.saveAll(newAssignments);
            log.debug("Added {} tags to ticket {}", toAdd.size(), ticketId);
        }
        return toAdd;
    }

    private void validateTicketExists(String ticketId) {
        if (!ticketRepository.existsById(ticketId)) {
            throw new TicketNotFoundException(ticketId);
        }
    }
}
