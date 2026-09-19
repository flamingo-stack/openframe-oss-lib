package com.openframe.external.service;

import com.openframe.api.service.ticket.TicketLifecycleService;
import com.openframe.api.service.ticket.TicketNoteService;
import com.openframe.api.service.ticket.TicketStatusService;
import com.openframe.api.service.ticket.TicketTagService;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketAttachment;
import com.openframe.data.document.ticket.TicketNote;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.repository.ticket.TicketAttachmentRepository;
import com.openframe.external.dto.ticket.TicketAttachmentResponse;
import com.openframe.external.dto.ticket.TicketNoteResponse;
import com.openframe.external.dto.ticket.TicketResponse;
import com.openframe.external.dto.ticket.TicketStatusResponse;
import com.openframe.external.dto.ticket.TicketTagResponse;
import com.openframe.external.mapper.TicketMapper;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketReadServiceTest {

    private static final AuthPrincipal PRINCIPAL = AuthPrincipal.builder().id("user-1").build();

    @Mock
    private TicketTagService ticketTagService;
    @Mock
    private TicketNoteService ticketNoteService;
    @Mock
    private TicketAttachmentRepository ticketAttachmentRepository;
    @Mock
    private TicketStatusService ticketStatusService;
    @Mock
    private TicketLifecycleService ticketLifecycleService;

    private TicketReadService service;

    @BeforeEach
    void setUp() {
        service = new TicketReadService(ticketTagService, ticketNoteService, ticketAttachmentRepository,
                ticketStatusService, ticketLifecycleService, new TicketMapper());
    }

    @Test
    void singleTicketIsAssembledWithAllRelationsAndAvailableTransitions() {
        Ticket ticket = ticket("t-1", "st-open", TicketStatusKind.CUSTOM);
        when(ticketTagService.getTagsByTicketIds(List.of("t-1"))).thenReturn(List.of(List.of(tag("tag-1"))));
        when(ticketNoteService.getNotesByTicketIds(List.of("t-1"))).thenReturn(List.of(List.of(note("n-1", "t-1"))));
        when(ticketAttachmentRepository.findByTicketIdIn(List.of("t-1"))).thenReturn(List.of(attachment("a-1", "t-1")));
        when(ticketStatusService.list()).thenReturn(List.of(status("st-open", "Open"), status("st-done", "Done")));
        when(ticketLifecycleService.availableTransitionsFor(PRINCIPAL, ticket))
                .thenReturn(List.of(status("st-done", "Done")));

        TicketResponse response = service.toResponse(PRINCIPAL, ticket);

        assertEquals("t-1", response.getId());
        assertEquals(List.of("tag-1"), tagIds(response));
        assertEquals(List.of("n-1"), noteIds(response));
        assertEquals(List.of("a-1"), attachmentIds(response));
        assertEquals("st-open", response.getStatusDefinition().getId());
        assertEquals("Open", response.getStatusDefinition().getName());
        assertEquals(List.of("st-done"),
                response.getAvailableTransitions().stream().map(TicketStatusResponse::getId).toList());
    }

    @Test
    void singleTicketWithoutStatusKindSkipsTheTransitionsLookup() {
        Ticket ticket = ticket("t-1", null, null);
        stubRelations(List.of("t-1"), List.of(List.of()), List.of(List.of()), List.of(), List.of());

        TicketResponse response = service.toResponse(PRINCIPAL, ticket);

        assertNull(response.getAvailableTransitions());
        assertNull(response.getStatusDefinition());
        verifyNoInteractions(ticketLifecycleService);
    }

    @Test
    void singleTicketInTerminalStatusKeepsAnEmptyTransitionList() {
        Ticket ticket = ticket("t-1", "st-archived", TicketStatusKind.ARCHIVED);
        stubRelations(List.of("t-1"), List.of(List.of()), List.of(List.of()), List.of(), List.of());
        when(ticketLifecycleService.availableTransitionsFor(PRINCIPAL, ticket)).thenReturn(List.of());

        TicketResponse response = service.toResponse(PRINCIPAL, ticket);

        assertEquals(List.of(), response.getAvailableTransitions());
    }

    @Test
    void listVariantBatchesLookupsOncePerPageAndSkipsTransitions() {
        List<Ticket> tickets = List.of(
                ticket("t-1", "st-open", TicketStatusKind.CUSTOM),
                ticket("t-2", "st-done", TicketStatusKind.RESOLVED));
        stubRelations(List.of("t-1", "t-2"),
                List.of(List.of(), List.of()), List.of(List.of(), List.of()), List.of(), List.of());

        List<TicketResponse> responses = service.toResponses(PRINCIPAL, tickets);

        assertEquals(List.of("t-1", "t-2"), responses.stream().map(TicketResponse::getId).toList());
        assertNull(responses.get(0).getAvailableTransitions());
        assertNull(responses.get(1).getAvailableTransitions());
        verify(ticketTagService).getTagsByTicketIds(List.of("t-1", "t-2"));
        verify(ticketNoteService).getNotesByTicketIds(List.of("t-1", "t-2"));
        verify(ticketAttachmentRepository).findByTicketIdIn(List.of("t-1", "t-2"));
        verify(ticketStatusService).list();
        verifyNoInteractions(ticketLifecycleService);
    }

    @Test
    void tagsAndNotesAreZippedToTicketsByPosition() {
        List<Ticket> tickets = List.of(ticket("t-1", null, null), ticket("t-2", null, null), ticket("t-3", null, null));
        stubRelations(List.of("t-1", "t-2", "t-3"),
                List.of(List.of(tag("tag-a")), List.of(), List.of(tag("tag-b"), tag("tag-c"))),
                List.of(List.of(), List.of(note("n-1", "t-2"), note("n-2", "t-2")), List.of(note("n-3", "t-3"))),
                List.of(), List.of());

        List<TicketResponse> responses = service.toResponses(PRINCIPAL, tickets);

        assertEquals(List.of("tag-a"), tagIds(responses.get(0)));
        assertEquals(List.of(), tagIds(responses.get(1)));
        assertEquals(List.of("tag-b", "tag-c"), tagIds(responses.get(2)));
        assertEquals(List.of(), noteIds(responses.get(0)));
        assertEquals(List.of("n-1", "n-2"), noteIds(responses.get(1)));
        assertEquals(List.of("n-3"), noteIds(responses.get(2)));
    }

    @Test
    void attachmentsAreGroupedByTicketIdRegardlessOfRepositoryOrder() {
        List<Ticket> tickets = List.of(ticket("t-1", null, null), ticket("t-2", null, null), ticket("t-3", null, null));
        stubRelations(List.of("t-1", "t-2", "t-3"),
                List.of(List.of(), List.of(), List.of()), List.of(List.of(), List.of(), List.of()),
                List.of(attachment("a-3", "t-3"), attachment("a-1", "t-1"), attachment("a-4", "t-3")),
                List.of());

        List<TicketResponse> responses = service.toResponses(PRINCIPAL, tickets);

        assertEquals(List.of("a-1"), attachmentIds(responses.get(0)));
        assertEquals(List.of(), attachmentIds(responses.get(1)));
        assertEquals(List.of("a-3", "a-4"), attachmentIds(responses.get(2)));
    }

    @Test
    void statusDefinitionIsResolvedByStatusIdAndUnknownOrMissingIdsStayNull() {
        List<Ticket> tickets = List.of(
                ticket("t-1", "st-done", TicketStatusKind.RESOLVED),
                ticket("t-2", "st-deleted", TicketStatusKind.CUSTOM),
                ticket("t-3", null, null),
                ticket("t-4", "st-open", TicketStatusKind.CUSTOM));
        stubRelations(List.of("t-1", "t-2", "t-3", "t-4"),
                List.of(List.of(), List.of(), List.of(), List.of()),
                List.of(List.of(), List.of(), List.of(), List.of()),
                List.of(),
                List.of(status("st-open", "Open"), status("st-done", "Done")));

        List<TicketResponse> responses = service.toResponses(PRINCIPAL, tickets);

        assertEquals("Done", responses.get(0).getStatusDefinition().getName());
        assertNull(responses.get(1).getStatusDefinition());
        assertNull(responses.get(2).getStatusDefinition());
        assertEquals("Open", responses.get(3).getStatusDefinition().getName());
    }

    @Test
    void duplicateStatusIdsKeepTheFirstDefinition() {
        stubRelations(List.of("t-1"), List.of(List.of()), List.of(List.of()), List.of(),
                List.of(status("st-open", "First"), status("st-open", "Second")));

        List<TicketResponse> responses = service.toResponses(PRINCIPAL, List.of(ticket("t-1", "st-open", null)));

        assertEquals("First", responses.getFirst().getStatusDefinition().getName());
    }

    @Test
    void emptyPageShortCircuitsWithoutAnyLookup() {
        List<TicketResponse> responses = service.toResponses(PRINCIPAL, List.of());

        assertEquals(List.of(), responses);
        verifyNoInteractions(ticketTagService, ticketNoteService, ticketAttachmentRepository,
                ticketStatusService, ticketLifecycleService);
    }

    private void stubRelations(List<String> ticketIds, List<List<Tag>> tags, List<List<TicketNote>> notes,
                               List<TicketAttachment> attachments, List<TicketStatusDefinition> statuses) {
        when(ticketTagService.getTagsByTicketIds(ticketIds)).thenReturn(tags);
        when(ticketNoteService.getNotesByTicketIds(ticketIds)).thenReturn(notes);
        when(ticketAttachmentRepository.findByTicketIdIn(ticketIds)).thenReturn(attachments);
        when(ticketStatusService.list()).thenReturn(statuses);
    }

    private static List<String> tagIds(TicketResponse response) {
        return response.getTags().stream().map(TicketTagResponse::getId).toList();
    }

    private static List<String> noteIds(TicketResponse response) {
        return response.getNotes().stream().map(TicketNoteResponse::getId).toList();
    }

    private static List<String> attachmentIds(TicketResponse response) {
        return response.getAttachments().stream().map(TicketAttachmentResponse::getId).toList();
    }

    private static Ticket ticket(String id, String statusId, TicketStatusKind statusKind) {
        return Ticket.builder().id(id).statusId(statusId).statusKind(statusKind).build();
    }

    private static Tag tag(String id) {
        return Tag.builder().id(id).key(id).build();
    }

    private static TicketNote note(String id, String ticketId) {
        return TicketNote.builder().id(id).ticketId(ticketId).content("note " + id).build();
    }

    private static TicketAttachment attachment(String id, String ticketId) {
        return TicketAttachment.builder().id(id).ticketId(ticketId).fileName(id + ".txt").build();
    }

    private static TicketStatusDefinition status(String id, String name) {
        return TicketStatusDefinition.builder().id(id).kind(TicketStatusKind.CUSTOM).name(name).build();
    }
}
