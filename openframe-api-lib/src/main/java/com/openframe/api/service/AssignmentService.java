package com.openframe.api.service;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.repository.assignment.ItemAssignmentRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AssignmentService {

    private final ItemAssignmentRepository repository;
    private final OrganizationRepository organizationRepository;
    private final MachineRepository machineRepository;
    private final TicketRepository ticketRepository;
    private final KnowledgeBaseItemRepository knowledgeBaseItemRepository;

    public Map<AssignmentTargetType, Long> countAssignmentsByTargetType(String itemId) {
        return repository.countByItemIdGroupedByTargetType(itemId);
    }

    public CountedGenericQueryResult<ItemAssignment> queryAssignments(
            String itemId, AssignmentTargetType targetType,
            CursorPaginationCriteria paginationCriteria, String search, SortInput sort) {
        log.debug("Querying assignments for item {} type {} search {} sort {} pagination {}",
                itemId, targetType, search, sort, paginationCriteria);

        CursorPaginationCriteria normalizedPagination = paginationCriteria.normalize();

        String sortField = validateSortField(sort != null ? sort.getField() : null);
        SortDirection sortDirection = (sort != null && sort.getDirection() != null)
                ? sort.getDirection() : SortDirection.DESC;

        int limit = normalizedPagination.getLimit();
        long totalFilteredCount = repository.countAssignments(itemId, targetType, search);

        List<ItemAssignment> raw = repository.findAssignmentsWithCursor(
                itemId, targetType, search, sortField, sortDirection.name(),
                normalizedPagination.getCursor(), limit + 1);
        boolean hasNextPage = raw.size() > limit;
        List<ItemAssignment> pageItems = hasNextPage ? raw.subList(0, limit) : raw;

        PageInfo pageInfo = buildPageInfo(pageItems, hasNextPage, normalizedPagination.hasCursor());

        return CountedGenericQueryResult.<ItemAssignment>builder()
                .items(pageItems)
                .pageInfo(pageInfo)
                .filteredCount((int) totalFilteredCount)
                .build();
    }

    private PageInfo buildPageInfo(List<ItemAssignment> pageItems, boolean hasNextPage, boolean hasPreviousPage) {
        String startCursor = pageItems.isEmpty() ? null : CursorCodec.encode(pageItems.getFirst().getId());
        String endCursor = pageItems.isEmpty() ? null : CursorCodec.encode(pageItems.getLast().getId());

        return PageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(hasPreviousPage)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }

    private String validateSortField(String field) {
        if (field == null || field.trim().isEmpty()) {
            return repository.getDefaultSortField();
        }
        String trimmedField = field.trim();
        if (!repository.isSortableField(trimmedField)) {
            log.warn("Invalid sort field requested for assignments: {}, using default", field);
            return repository.getDefaultSortField();
        }
        return trimmedField;
    }

    @Transactional
    public ItemAssignment assignItem(String itemId, AssignmentItemType itemType,
                                      AssignmentTargetType targetType, String targetId) {
        String displayName = resolveDisplayName(targetType, targetId);
        log.info("Assigning {}:{} ({}) to {} {}", targetType, targetId, displayName, itemType, itemId);
        ItemAssignment assignment = ItemAssignment.builder()
                .itemId(itemId)
                .itemType(itemType)
                .targetType(targetType)
                .targetId(targetId)
                .displayName(displayName)
                .build();
        return repository.save(assignment);
    }

    @Transactional
    public void unassignItem(String itemId, AssignmentTargetType targetType, String targetId) {
        log.info("Unassigning {}:{} from item {}", targetType, targetId, itemId);
        repository.deleteByItemIdAndTargetTypeAndTargetId(itemId, targetType, targetId);
    }

    @Transactional
    public void unassignAllByType(String itemId, AssignmentTargetType targetType) {
        log.info("Unassigning all {} from item {}", targetType, itemId);
        repository.deleteByItemIdAndTargetType(itemId, targetType);
    }

    private String resolveDisplayName(AssignmentTargetType type, String targetId) {
        return switch (type) {
            case ORGANIZATION -> organizationRepository.findByOrganizationId(targetId)
                    .map(Organization::getName).orElse(targetId);
            case DEVICE -> machineRepository.findByMachineId(targetId)
                    .map(m -> m.getHostname() != null ? m.getHostname() : m.getDisplayName())
                    .orElse(targetId);
            case TICKET -> ticketRepository.findById(targetId)
                    .map(t -> t.getTicketNumber() + " - " + t.getTitle()).orElse(targetId);
            case KNOWLEDGE_ARTICLE -> knowledgeBaseItemRepository.findById(targetId)
                    .map(KnowledgeBaseItem::getName).orElse(targetId);
        };
    }
}
