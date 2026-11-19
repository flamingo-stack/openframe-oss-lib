package com.openframe.api.service.ticket;

import com.openframe.audit.AuditRecorder;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.TICKET_TAG_ADD;
import static com.openframe.data.document.audit.AuditAction.TICKET_TAG_REMOVE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketTagServiceSyncTest {

    private static final String TICKET_ID = "ticket-1";

    @Mock private TagRepository tagRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock private TicketRepository ticketRepository;
    @Mock private AuditRecorder auditRecorder;

    @InjectMocks private TicketTagService service;

    @Test
    void syncTagAssignments_tagsReplaced_recordsOnlyTheRemovedAndTheAddedTags() {
        when(tagRepository.findAllById(List.of("t2", "t3")))
                .thenReturn(List.of(Tag.builder().id("t2").build(), Tag.builder().id("t3").build()));
        when(tagAssignmentRepository.findByEntityIdAndEntityType(TICKET_ID, TagEntityType.TICKET))
                .thenReturn(List.of(assigned("t1"), assigned("t2")));

        service.syncTagAssignments(TICKET_ID, List.of("t2", "t3"));

        ArgumentCaptor<AuditEntry> entries = ArgumentCaptor.forClass(AuditEntry.class);
        verify(auditRecorder, times(2)).record(entries.capture());
        assertThat(entries.getAllValues())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId, AuditEntry::getDetails)
                .containsExactly(
                        tuple(TICKET_TAG_REMOVE, TICKET_ID, Map.of("tagId", "t1")),
                        tuple(TICKET_TAG_ADD, TICKET_ID, Map.of("tagId", "t3")));
    }

    private static TagAssignment assigned(String tagId) {
        return TagAssignment.builder().entityId(TICKET_ID).tagId(tagId).entityType(TagEntityType.TICKET).build();
    }
}
