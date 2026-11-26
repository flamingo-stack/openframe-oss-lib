package com.openframe.api.service.ticket;

import com.openframe.audit.AuditRecorder;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.BooleanSupplier;

import static com.openframe.data.document.audit.AuditAction.TICKET_TAG_ADD;
import static com.openframe.data.document.audit.AuditAction.TICKET_TAG_REMOVE;
import static com.openframe.data.document.audit.AuditTargetType.TICKET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketTagServiceAssignTest {

    private static final String TICKET_ID = "ticket-1";
    private static final String TAG_ID = "tag-1";
    private static final Map<String, Object> URGENT_TAG_DETAILS =
            Map.of("tagIds", List.of(TAG_ID), "tagKeys", List.of("urgent"));
    private static final TagAssignment ASSIGNMENT =
            TagAssignment.builder().entityId(TICKET_ID).tagId(TAG_ID).entityType(TagEntityType.TICKET).build();

    @Mock private TagRepository tagRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock private TicketRepository ticketRepository;
    @Mock private AuditRecorder auditRecorder;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private TicketTagService service;
    @Captor private ArgumentCaptor<AuditEntry> entryCaptor;

    @Test
    void addTagToTicket_tagNotOnTheTicket_assignsItAndAnswersChanged() {
        urgentTagOnAnExistingTicket();
        runsTheAuditedWork();
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(TICKET_ID, TAG_ID, TagEntityType.TICKET))
                .thenReturn(Optional.empty());

        assertThat(service.addTagToTicket(admin(), TICKET_ID, TAG_ID)).isTrue();

        verify(tagAssignmentRepository).save(ASSIGNMENT);
    }

    @Test
    void addTagToTicket_tagAlreadyOnTheTicket_assignsNothingAndAnswersUnchanged() {
        urgentTagOnAnExistingTicket();
        runsTheAuditedWork();
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(TICKET_ID, TAG_ID, TagEntityType.TICKET))
                .thenReturn(Optional.of(ASSIGNMENT));

        assertThat(service.addTagToTicket(admin(), TICKET_ID, TAG_ID)).isFalse();

        verify(tagAssignmentRepository, never()).save(ASSIGNMENT);
    }

    @Test
    void addTagToTicket_callerNotAdmin_isRefusedInsideTheAuditedRun() {
        urgentTag();
        runsTheAuditedWork();

        assertThatThrownBy(() -> service.addTagToTicket(agent(), TICKET_ID, TAG_ID))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Operation requires ADMIN access");

        verify(auditedMethodRunner).runWhenChanged(eq(TICKET_TAG_ADD), eq(TICKET), eq(TICKET_ID),
                eq(URGENT_TAG_DETAILS), any());
    }

    @Test
    void removeTagFromTicket_tagOnTheTicket_removesItAndAnswersChanged() {
        urgentTagOnAnExistingTicket();
        runsTheAuditedWork();
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(TICKET_ID, TAG_ID, TagEntityType.TICKET))
                .thenReturn(Optional.of(ASSIGNMENT));

        assertThat(service.removeTagFromTicket(admin(), TICKET_ID, TAG_ID)).isTrue();

        verify(tagAssignmentRepository).deleteByEntityIdAndTagIdAndEntityType(TICKET_ID, TAG_ID, TagEntityType.TICKET);
    }

    @Test
    void removeTagFromTicket_tagNotOnTheTicket_answersUnchanged() {
        urgentTagOnAnExistingTicket();
        runsTheAuditedWork();
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(TICKET_ID, TAG_ID, TagEntityType.TICKET))
                .thenReturn(Optional.empty());

        assertThat(service.removeTagFromTicket(admin(), TICKET_ID, TAG_ID)).isFalse();
    }

    @Test
    void removeTagFromTicket_callerNotAdmin_isRefusedInsideTheAuditedRun() {
        urgentTag();
        runsTheAuditedWork();

        assertThatThrownBy(() -> service.removeTagFromTicket(agent(), TICKET_ID, TAG_ID))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Operation requires ADMIN access");

        verify(auditedMethodRunner).runWhenChanged(eq(TICKET_TAG_REMOVE), eq(TICKET), eq(TICKET_ID),
                eq(URGENT_TAG_DETAILS), any());
    }

    @Test
    void createTagAssignments_tagRepeatedInTheList_assignsItOnce() {
        service.createTagAssignments(TICKET_ID, List.of(TAG_ID, TAG_ID));

        verify(tagAssignmentRepository).saveAll(List.of(ASSIGNMENT));
    }

    @Test
    void createTagAssignments_twoTags_recordsOneAddPerTag() {
        urgentTag();
        when(tagRepository.findById("tag-2")).thenReturn(Optional.of(Tag.builder().id("tag-2").key("vip").build()));

        service.createTagAssignments(TICKET_ID, List.of(TAG_ID, "tag-2"));

        verify(auditRecorder, times(2)).record(entryCaptor.capture());
        assertThat(entryCaptor.getAllValues())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId, AuditEntry::getDetails)
                .containsExactly(
                        tuple(TICKET_TAG_ADD, TICKET_ID, URGENT_TAG_DETAILS),
                        tuple(TICKET_TAG_ADD, TICKET_ID, Map.of("tagIds", List.of("tag-2"), "tagKeys", List.of("vip"))));
    }

    private void urgentTagOnAnExistingTicket() {
        urgentTag();
        when(ticketRepository.existsById(TICKET_ID)).thenReturn(true);
    }

    private void urgentTag() {
        when(tagRepository.findById(TAG_ID)).thenReturn(Optional.of(Tag.builder().id(TAG_ID).key("urgent").build()));
    }

    private void runsTheAuditedWork() {
        when(auditedMethodRunner.runWhenChanged(any(), any(), any(), any(), any()))
                .thenAnswer(invocation -> invocation.<BooleanSupplier>getArgument(4).getAsBoolean());
    }

    private static AuthPrincipal admin() {
        return AuthPrincipal.builder().id("user-1").actorType(ActorType.ADMIN).build();
    }

    private static AuthPrincipal agent() {
        return AuthPrincipal.builder().id("machine-1").actorType(ActorType.AGENT).build();
    }
}
