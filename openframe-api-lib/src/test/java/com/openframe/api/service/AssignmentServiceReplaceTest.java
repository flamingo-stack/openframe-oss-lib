package com.openframe.api.service;

import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import com.openframe.data.repository.assignment.ItemAssignmentRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DuplicateKeyException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AssignmentServiceReplaceTest {

    private static final AssignmentTargetType ORGANIZATION = AssignmentTargetType.ORGANIZATION;

    private final ItemAssignmentRepository repository = mock(ItemAssignmentRepository.class);
    private final AssignmentService service = new AssignmentService(
            repository,
            mock(OrganizationRepository.class),
            mock(MachineRepository.class),
            mock(TicketRepository.class),
            mock(KnowledgeBaseItemRepository.class));

    @Test
    @DisplayName("replacing assigns the missing targets, unassigns the rest and does not re-assign the kept ones")
    void replaceAppliesOnlyTheDifference() {
        when(repository.findByItemIdAndTargetType("a1", ORGANIZATION))
                .thenReturn(List.of(assigned("o1"), assigned("o2")));

        service.replaceAssignments("a1", AssignmentItemType.KNOWLEDGE_ARTICLE, ORGANIZATION, List.of("o2", "o3"));

        verify(repository).deleteByItemIdAndTargetTypeAndTargetId("a1", ORGANIZATION, "o1");
        verify(repository, never()).deleteByItemIdAndTargetTypeAndTargetId(eq("a1"), any(), eq("o2"));

        // (item, type, target) is unique: saving o2 again would be refused by the index.
        ArgumentCaptor<ItemAssignment> added = ArgumentCaptor.forClass(ItemAssignment.class);
        verify(repository).save(added.capture());
        assertThat(added.getValue().getTargetId()).isEqualTo("o3");
        assertThat(added.getValue().getItemType()).isEqualTo(AssignmentItemType.KNOWLEDGE_ARTICLE);
    }

    @Test
    @DisplayName("an empty list unassigns every target of that type")
    void emptyListClears() {
        when(repository.findByItemIdAndTargetType("a1", ORGANIZATION)).thenReturn(List.of(assigned("o1")));

        service.replaceAssignments("a1", AssignmentItemType.KNOWLEDGE_ARTICLE, ORGANIZATION, List.of());

        verify(repository).deleteByItemIdAndTargetTypeAndTargetId("a1", ORGANIZATION, "o1");
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("a target another save assigned in between is not a failure")
    void targetAssignedMeanwhileIsNotAFailure() {
        when(repository.findByItemIdAndTargetType("a1", ORGANIZATION)).thenReturn(List.of());
        when(repository.save(any())).thenThrow(new DuplicateKeyException("item_target_unique"));

        assertThatCode(() -> service.replaceAssignments(
                "a1", AssignmentItemType.KNOWLEDGE_ARTICLE, ORGANIZATION, List.of("o1")))
                .doesNotThrowAnyException();
    }

    private static ItemAssignment assigned(String targetId) {
        return ItemAssignment.builder()
                .itemId("a1")
                .itemType(AssignmentItemType.KNOWLEDGE_ARTICLE)
                .targetType(ORGANIZATION)
                .targetId(targetId)
                .build();
    }
}
