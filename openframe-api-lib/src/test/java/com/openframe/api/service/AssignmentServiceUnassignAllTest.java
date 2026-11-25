package com.openframe.api.service;

import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditedWork;
import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import com.openframe.data.repository.assignment.ItemAssignmentRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static com.openframe.data.document.audit.AuditAction.LINK_DELETE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AssignmentServiceUnassignAllTest {

    private static final AssignmentTargetType ORGANIZATION = AssignmentTargetType.ORGANIZATION;

    private final ItemAssignmentRepository repository = mock(ItemAssignmentRepository.class);
    private final AuditedMethodRunner auditedMethodRunner = mock(AuditedMethodRunner.class);
    private final AssignmentService service = new AssignmentService(
            repository,
            mock(OrganizationRepository.class),
            mock(MachineRepository.class),
            mock(TicketRepository.class),
            mock(KnowledgeBaseItemRepository.class), auditedMethodRunner);

    @Test
    void unassignAllByType_severalLinks_storesOneDeleteEventPerLink() {
        twoLinkedCustomers();

        service.unassignAllByType("a1", ORGANIZATION);

        ArgumentCaptor<AuditCall> events = ArgumentCaptor.forClass(AuditCall.class);
        verify(auditedMethodRunner, times(2)).run(events.capture(), any());
        assertThat(events.getAllValues())
                .extracting(AuditCall::action, event -> event.detailsFromResult().apply(null).get("targetIds"))
                .containsExactly(tuple(LINK_DELETE, List.of("o1")), tuple(LINK_DELETE, List.of("o2")));
    }

    @Test
    void unassignAllByType_severalLinks_deletesEachLinkWithoutReadingItAgain() {
        twoLinkedCustomers();

        service.unassignAllByType("a1", ORGANIZATION);

        verify(repository).deleteByItemIdAndTargetTypeAndTargetId("a1", ORGANIZATION, "o1");
        verify(repository).deleteByItemIdAndTargetTypeAndTargetId("a1", ORGANIZATION, "o2");
        verify(repository, never()).findByItemIdAndTargetTypeAndTargetId(any(), any(), any());
    }

    private void twoLinkedCustomers() {
        when(repository.findByItemIdAndTargetType("a1", ORGANIZATION)).thenReturn(List.of(link("o1"), link("o2")));
        when(auditedMethodRunner.run(any(AuditCall.class), any()))
                .thenAnswer(invocation -> invocation.<AuditedWork<?, ?>>getArgument(1).run());
    }

    private static ItemAssignment link(String targetId) {
        return ItemAssignment.builder()
                .itemId("a1")
                .itemType(AssignmentItemType.KNOWLEDGE_ARTICLE)
                .targetType(ORGANIZATION)
                .targetId(targetId)
                .displayName("Customer " + targetId)
                .build();
    }
}
