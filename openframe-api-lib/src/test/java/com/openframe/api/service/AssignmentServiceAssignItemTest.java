package com.openframe.api.service;

import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.api.dto.assignment.AssignmentTarget;
import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.ticket.Ticket;
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

import static com.openframe.data.document.assignment.AssignmentTargetType.DEVICE;
import static com.openframe.data.document.assignment.AssignmentTargetType.TICKET;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
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
    private final MachineRepository machineRepository = mock(MachineRepository.class);
    private final TicketRepository ticketRepository = mock(TicketRepository.class);
    private final AuditedMethodRunner auditedMethodRunner = mock(AuditedMethodRunner.class, CALLS_REAL_METHODS);
    private final AssignmentService service = new AssignmentService(
            repository,
            organizationRepository,
            machineRepository,
            ticketRepository,
            mock(KnowledgeBaseItemRepository.class), auditedMethodRunner);

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
    }

    @Test
    @DisplayName("assigning the same target again returns the existing assignment, untouched, and records no new link")
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
        when(repository.save(any())).thenReturn(existing);
        when(repository.findByItemIdAndTargetTypeAndTargetId("a1", ORGANIZATION, "o1"))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(existing));

        ItemAssignment first = service.assignItem("a1", ARTICLE, ORGANIZATION, "o1");
        ItemAssignment second = service.assignItem("a1", ARTICLE, ORGANIZATION, "o1");

        assertThat(first).isSameAs(existing);
        assertThat(second).isSameAs(existing);
        verify(repository, times(1)).save(any());
        verify(repository, never()).delete(any());
        verify(auditedMethodRunner, times(1)).run(any(AuditCall.class), any());
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
    void assignItem_targetAssignedBetweenReadAndSave_returnsTheAssignmentSavedMeanwhile() {
        ItemAssignment savedMeanwhile = ItemAssignment.builder()
                .id("as-1")
                .itemId("a1")
                .itemType(ARTICLE)
                .targetType(ORGANIZATION)
                .targetId("o1")
                .build();
        when(repository.findByItemIdAndTargetTypeAndTargetId("a1", ORGANIZATION, "o1"))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(savedMeanwhile));
        when(repository.save(any())).thenThrow(new DuplicateKeyException("item_target_unique"));

        ItemAssignment assignment = service.assignItem("a1", ARTICLE, ORGANIZATION, "o1");

        assertThat(assignment).isSameAs(savedMeanwhile);
    }

    @Test
    void assignItem_ticketWithoutTitle_namesTheTicketByItsNumber() {
        when(ticketRepository.findById("t1")).thenReturn(Optional.of(Ticket.builder().ticketNumber(42).build()));
        givenNotAssignedYet(TICKET, "t1");

        ItemAssignment assignment = service.assignItem("a1", ARTICLE, TICKET, "t1");

        assertThat(assignment.getDisplayName()).isEqualTo("42");
    }

    @Test
    void assignItem_deviceWithoutHostname_namesTheDeviceByItsDisplayName() {
        Machine device = new Machine();
        device.setDisplayName("Reception PC");
        when(machineRepository.findByMachineId("m1")).thenReturn(Optional.of(device));
        givenNotAssignedYet(DEVICE, "m1");

        ItemAssignment assignment = service.assignItem("a1", ARTICLE, DEVICE, "m1");

        assertThat(assignment.getDisplayName()).isEqualTo("Reception PC");
    }

    @Test
    void assignItem_linkedToACustomer_eventFiledUnderThatCustomer() {
        givenNotAssignedYet(ORGANIZATION, "o1");

        service.assignItem("a1", ARTICLE, ORGANIZATION, "o1");

        assertThat(linkCall())
                .returns(true, AuditCall::ignoresTargetOrganizationAndDevice)
                .returns("o1", call -> call.organizationIdOf().apply(null))
                .returns(null, call -> call.deviceIdOf().apply(null));
    }

    @Test
    void assignItem_linkedToADevice_eventFiledUnderThatDevice() {
        givenNotAssignedYet(DEVICE, "m1");

        service.assignItem("a1", ARTICLE, DEVICE, "m1");

        assertThat(linkCall())
                .returns(true, AuditCall::ignoresTargetOrganizationAndDevice)
                .returns(null, call -> call.organizationIdOf().apply(null))
                .returns("m1", call -> call.deviceIdOf().apply(null));
    }

    @Test
    void assignItem_linkedToATicket_eventKeepsTheCustomerAndDeviceOfTheItem() {
        givenNotAssignedYet(TICKET, "t1");

        service.assignItem("a1", ARTICLE, TICKET, "t1");

        assertThat(linkCall().ignoresTargetOrganizationAndDevice()).isFalse();
    }

    @Test
    void assignItem_articleLinked_eventTargetsTheArticle() {
        givenNotAssignedYet(ORGANIZATION, "o1");

        service.assignItem("a1", ARTICLE, ORGANIZATION, "o1");

        assertThat(linkCall().targetType()).isEqualTo(AuditTargetType.KB_ARTICLE);
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

    private AuditCall linkCall() {
        ArgumentCaptor<AuditCall> call = ArgumentCaptor.forClass(AuditCall.class);
        verify(auditedMethodRunner).run(call.capture(), any());
        return call.getValue();
    }

    private void givenNotAssignedYet(AssignmentTargetType targetType, String targetId) {
        when(repository.findByItemIdAndTargetTypeAndTargetId("a1", targetType, targetId)).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }
}
