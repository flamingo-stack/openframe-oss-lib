package com.openframe.api.service;

import com.openframe.api.dto.assignment.AssignmentTarget;
import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.repository.assignment.ItemAssignmentRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DuplicateKeyException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * assignItem as an idempotent operation: the first call inserts, a repeat returns what the first
 * one inserted. And the reverse lookup behind the Assigned Articles tab.
 */
class AssignmentServiceAssignItemTest {

    private static final AssignmentTargetType ORGANIZATION = AssignmentTargetType.ORGANIZATION;
    private static final AssignmentItemType ARTICLE = AssignmentItemType.KNOWLEDGE_ARTICLE;

    private final ItemAssignmentRepository repository = mock(ItemAssignmentRepository.class);
    private final OrganizationRepository organizationRepository = mock(OrganizationRepository.class);
    private final AssignmentService service = new AssignmentService(
            repository,
            organizationRepository,
            mock(MachineRepository.class),
            mock(TicketRepository.class),
            mock(KnowledgeBaseItemRepository.class));

    @Test
    @DisplayName("a first assignment is inserted with the target's resolved display name")
    void firstAssignmentIsInsertedWithDisplayName() {
        Organization organization = mock(Organization.class);
        when(organization.getName()).thenReturn("Dunder Mifflin");
        when(organizationRepository.findByOrganizationId("o1")).thenReturn(Optional.of(organization));
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ItemAssignment assignment = service.assignItem("a1", ARTICLE, ORGANIZATION, "o1");

        ArgumentCaptor<ItemAssignment> saved = ArgumentCaptor.forClass(ItemAssignment.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue())
                .returns("a1", ItemAssignment::getItemId)
                .returns(ARTICLE, ItemAssignment::getItemType)
                .returns(ORGANIZATION, ItemAssignment::getTargetType)
                .returns("o1", ItemAssignment::getTargetId)
                .returns("Dunder Mifflin", ItemAssignment::getDisplayName);
        assertThat(assignment).isSameAs(saved.getValue());
        verify(repository, never()).findByItemIdAndTargetTypeAndTargetId(any(), any(), any());
    }

    @Test
    @DisplayName("assigning the same target again returns the existing assignment, untouched, instead of failing")
    void repeatedAssignmentReturnsTheExistingOne() {
        ItemAssignment existing = ItemAssignment.builder()
                .id("as-1")
                .itemId("a1")
                .itemType(ARTICLE)
                .targetType(ORGANIZATION)
                .targetId("o1")
                .displayName("Dunder Mifflin")
                .createdAt(Instant.ofEpochMilli(1_760_000_000_000L))
                .build();
        when(repository.save(any()))
                .thenReturn(existing)
                .thenThrow(new DuplicateKeyException("item_target_unique"));
        when(repository.findByItemIdAndTargetTypeAndTargetId("a1", ORGANIZATION, "o1"))
                .thenReturn(Optional.of(existing));

        ItemAssignment first = service.assignItem("a1", ARTICLE, ORGANIZATION, "o1");
        ItemAssignment second = service.assignItem("a1", ARTICLE, ORGANIZATION, "o1");

        assertThat(first).isSameAs(existing);
        assertThat(second).isSameAs(existing);
        verify(repository, times(2)).save(any());
        verify(repository, never()).delete(any());
    }

    @Test
    @DisplayName("a duplicate whose row is gone again by the time it is read is still an error, not a null")
    void duplicateWithoutARowToReturnIsRethrown() {
        DuplicateKeyException raced = new DuplicateKeyException("item_target_unique");
        when(repository.save(any())).thenThrow(raced);
        when(repository.findByItemIdAndTargetTypeAndTargetId("a1", ORGANIZATION, "o1"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.assignItem("a1", ARTICLE, ORGANIZATION, "o1")).isSameAs(raced);
    }

    @Test
    @DisplayName("the reverse lookup asks the repository for the item ids of that item type and target")
    void findAssignedItemIdsDelegatesToTheRepository() {
        when(repository.findItemIdsByTarget(ARTICLE, ORGANIZATION, "o1")).thenReturn(List.of("a1", "a2"));

        List<String> ids = service.findAssignedItemIds(ARTICLE, new AssignmentTarget(ORGANIZATION, "o1"));

        assertThat(ids).containsExactly("a1", "a2");
    }

    @Test
    @DisplayName("a target that could not be resolved to an id matches nothing, without a database read")
    void unresolvableTargetMatchesNothing() {
        List<String> ids = service.findAssignedItemIds(ARTICLE, AssignmentTarget.unresolvable(ORGANIZATION));

        assertThat(ids).isEmpty();
        verify(repository, never()).findItemIdsByTarget(any(), any(), any());
    }
}
