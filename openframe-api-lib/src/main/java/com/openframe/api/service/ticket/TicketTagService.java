package com.openframe.api.service.ticket;

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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import static com.openframe.api.util.AuthPrincipalUtils.validateAdminAccess;

@Service
@Slf4j
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TicketTagService {

    private final TagRepository tagRepository;
    private final TagAssignmentRepository tagAssignmentRepository;
    private final TicketRepository ticketRepository;

    public List<Tag> getTags(AuthPrincipal principal) {
        validateAdminAccess(principal);
        return tagRepository.findByEntityType(TagEntityType.TICKET);
    }

    public List<Tag> getTags() {
        return tagRepository.findByEntityType(TagEntityType.TICKET);
    }

    @Transactional
    public void addTagToTicket(AuthPrincipal principal, @NotBlank String ticketId, @NotBlank String tagId) {
        validateAdminAccess(principal);
        validateTicketExists(ticketId);
        log.info("Adding tag {} to ticket {} by: {}", tagId, ticketId, principal.getDisplayName());
        if (tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(ticketId, tagId, TagEntityType.TICKET).isEmpty()) {
            TagAssignment assignment = TagAssignment.builder()
                    .entityId(ticketId)
                    .tagId(tagId)
                    .entityType(TagEntityType.TICKET)
                    .build();
            tagAssignmentRepository.save(assignment);
        }
    }

    @Transactional
    public void removeTagFromTicket(AuthPrincipal principal, @NotBlank String ticketId, @NotBlank String tagId) {
        validateAdminAccess(principal);
        validateTicketExists(ticketId);
        log.info("Removing tag {} from ticket {} by: {}", tagId, ticketId, principal.getDisplayName());
        tagAssignmentRepository.deleteByEntityIdAndTagIdAndEntityType(ticketId, tagId, TagEntityType.TICKET);
    }

    @Transactional
    public void createTagAssignments(String ticketId, List<String> tagIds) {
        if (tagIds == null || tagIds.isEmpty()) {
            return;
        }
        log.debug("Creating {} tag assignments for ticket {}", tagIds.size(), ticketId);
        List<TagAssignment> assignments = tagIds.stream()
                .map(tagId -> TagAssignment.builder()
                        .entityId(ticketId)
                        .tagId(tagId)
                        .entityType(TagEntityType.TICKET)
                        .build())
                .toList();
        tagAssignmentRepository.saveAll(assignments);
    }

    @Transactional
    public void syncTagAssignments(String ticketId, List<String> tagIds) {
        if (tagIds == null) {
            return;
        }
        log.debug("Syncing tags for ticket {}: {}", ticketId, tagIds);
        validateTagsExist(tagIds);
        List<TagAssignment> currentAssignments = tagAssignmentRepository
                .findByEntityIdAndEntityType(ticketId, TagEntityType.TICKET);
        Set<String> currentTagIds = currentAssignments.stream()
                .map(TagAssignment::getTagId)
                .collect(Collectors.toSet());
        Set<String> newTagIds = new HashSet<>(tagIds);
        removeStaleAssignments(currentAssignments, newTagIds);
        addNewAssignments(ticketId, tagIds, currentTagIds);
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
            throw new IllegalArgumentException("Tags not found: " + notFound);
        }
    }

    private void removeStaleAssignments(List<TagAssignment> currentAssignments, Set<String> newTagIds) {
        List<TagAssignment> toRemove = currentAssignments.stream()
                .filter(a -> !newTagIds.contains(a.getTagId()))
                .toList();
        if (!toRemove.isEmpty()) {
            tagAssignmentRepository.deleteAll(toRemove);
            log.debug("Removed {} tags from ticket", toRemove.size());
        }
    }

    private void addNewAssignments(String ticketId, List<String> tagIds, Set<String> currentTagIds) {
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
    }

    private void validateTicketExists(String ticketId) {
        if (!ticketRepository.existsById(ticketId)) {
            throw new IllegalArgumentException("Ticket not found: " + ticketId);
        }
    }
}
