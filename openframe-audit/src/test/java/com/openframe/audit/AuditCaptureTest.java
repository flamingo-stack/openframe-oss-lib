package com.openframe.audit;

import com.openframe.audit.targets.AuditTarget;
import com.openframe.audit.targets.AuditTargetRepository;
import com.openframe.audit.targets.AuditTargets;
import com.openframe.audit.targets.LoadedTarget;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.audit.AuditSource;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.ticket.Ticket;
import org.bson.Document;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.StaticApplicationContext;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditCaptureTest {

    private static final String TICKET_ID = "ticket-1";
    private static final AuditTarget<Ticket> TICKET_TARGET =
            AuditTarget.of(AuditTargetType.TICKET, Ticket.class, Ticket::getTitle)
                    .withOrganizationId(Ticket::getOrganizationId)
                    .withDeviceId(Ticket::getDeviceId)
                    .withIgnoredFields(Set.of("lastActivityAt"))
                    .withMaskedFields(Set.of("description"));
    private static final AuditContext REQUEST_CONTEXT = new AuditContext(AuditActor.staff("staff-1"),
            new AuditSource("203.0.113.1", "Chrome", "request-1", "session-1"), null);

    @Mock private AuditTargetRepository targetRepository;
    @Mock private AuditRecorder recorder;
    @Captor private ArgumentCaptor<AuditEntry> entryCaptor;
    @Captor private ArgumentCaptor<AuditContext> contextCaptor;

    private AuditCapture capture;

    @BeforeEach
    void setUp() {
        AuditTargets targets = new AuditTargets(List.of(() -> List.of(TICKET_TARGET)));
        AuditOutcomeResolver outcomeResolver = new AuditOutcomeResolver(List.of(),
                new ExceptionHandlerStatuses(new StaticApplicationContext()));
        capture = new AuditCapture(targets, targetRepository, outcomeResolver, recorder, true);
        lenient().when(recorder.context()).thenReturn(REQUEST_CONTEXT);
        lenient().when(recorder.targetIdOf(any(), any())).thenAnswer(call -> call.getArgument(1));
        lenient().when(recorder.capturing(any(), any()))
                .thenAnswer(call -> call.<AuditedWork<Object, RuntimeException>>getArgument(1).run());
    }

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void recordsTheChangedFieldsOfAnUpdate() {
        Ticket before = ticket("Printer offline");
        Ticket after = ticket("Printer offline");
        after.setDescription("new text");
        stored(before, after);
        when(targetRepository.storedFieldsOf(before)).thenReturn(fields("OPEN", "old text", "10:00"));
        when(targetRepository.storedFieldsOf(after)).thenReturn(fields("ARCHIVED", "new text", "10:05"));

        String result = capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        assertThat(result).isEqualTo("archived");
        AuditEntry entry = recordedEntry();
        assertThat(entry.getAction()).isEqualTo(AuditAction.TICKET_ARCHIVE);
        assertThat(entry.getOutcome()).isEqualTo(AuditOutcome.SUCCESS);
        assertThat(entry.getTargetType()).isEqualTo(AuditTargetType.TICKET);
        assertThat(entry.getTargetId()).isEqualTo(TICKET_ID);
        assertThat(entry.getTargetName()).isEqualTo("Printer offline");
        assertThat(entry.getOrganizationId()).isEqualTo("org-1");
        assertThat(entry.getDeviceId()).isEqualTo("device-1");
        assertThat(entry.getChanges()).containsOnlyKeys("statusKind", "description")
                .containsEntry("statusKind", new AuditChange("OPEN", "ARCHIVED"))
                .containsEntry("description", new AuditChange(AuditCapture.MASKED_VALUE, AuditCapture.MASKED_VALUE));
        assertThat(entry.getDetails()).isNull();
    }

    @Test
    void marksAnUpdateThatChangedNothing() {
        Ticket before = ticket("Printer offline");
        Ticket after = ticket("Printer offline");
        stored(before, after);
        when(targetRepository.storedFieldsOf(before)).thenReturn(fields("OPEN", "text", "10:00"));
        when(targetRepository.storedFieldsOf(after)).thenReturn(fields("OPEN", "text", "10:05"));

        capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> null);

        AuditEntry entry = recordedEntry();
        assertThat(entry.getChanges()).isNull();
        assertThat(entry.getDetails()).containsEntry(AuditCapture.NO_CHANGE_DETAIL, true);
    }

    @Test
    void recordsUnderTheCallersContextAndGivesItsOwnEventIdToEventsRecordedInside() {
        stored(ticket("Printer offline"), ticket("Printer offline"));
        when(targetRepository.storedFieldsOf(any())).thenReturn(fields("OPEN", "text", "10:00"));

        capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        AuditEntry entry = recordedEntry();
        verify(recorder).recordCaptured(any(), contextCaptor.capture());
        assertThat(contextCaptor.getValue()).isEqualTo(REQUEST_CONTEXT);
        verify(recorder).capturing(contextCaptor.capture(), any());
        assertThat(contextCaptor.getValue()).isEqualTo(REQUEST_CONTEXT.withParentEventId(entry.getId()));
        assertThat(entry.getId()).hasSize(26);
    }

    @Test
    void takesTheIdOfACreatedRecordFromTheResult() {
        when(targetRepository.load(anyList(), eq("ticket-2")))
                .thenReturn(Optional.of(new LoadedTarget(TICKET_TARGET, ticket("New ticket"))));
        AuditCall call = AuditCall.of(AuditAction.TICKET_CREATE, AuditTargetType.TICKET, null, Map.of())
                .withTargetIdFromResult(result -> (String) result)
                .withTargetIdInResult(true);

        String result = capture.capture(call, () -> "ticket-2");

        assertThat(result).isEqualTo("ticket-2");
        AuditEntry entry = recordedEntry();
        assertThat(entry.getTargetId()).isEqualTo("ticket-2");
        assertThat(entry.getTargetName()).isEqualTo("New ticket");
        assertThat(entry.getChanges()).isNull();
        verify(targetRepository, times(1)).load(any(), any());
    }

    @Test
    void namesARecordGoneAfterTheCallFromTheReadBeforeIt() {
        when(targetRepository.load(anyList(), eq(TICKET_ID)))
                .thenReturn(Optional.of(new LoadedTarget(TICKET_TARGET, ticket("Old ticket"))))
                .thenReturn(Optional.empty());

        capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> { });

        AuditEntry entry = recordedEntry();
        assertThat(entry.getTargetName()).isEqualTo("Old ticket");
        assertThat(entry.getOrganizationId()).isEqualTo("org-1");
        assertThat(entry.getChanges()).isNull();
    }

    @Test
    void recordsARefusalMarksItRecordedAndRethrowsIt() {
        when(targetRepository.load(anyList(), eq(TICKET_ID)))
                .thenReturn(Optional.of(new LoadedTarget(TICKET_TARGET, ticket("Printer offline"))));
        ForbiddenException refusal = new ForbiddenException("Only admins can archive tickets");

        assertThatThrownBy(() -> capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> {
            throw refusal;
        })).isSameAs(refusal);

        AuditEntry entry = recordedEntry();
        assertThat(entry.getOutcome()).isEqualTo(AuditOutcome.REFUSED);
        assertThat(entry.getReason()).isEqualTo("Only admins can archive tickets");
        assertThat(entry.getTargetName()).isEqualTo("Printer offline");
        verify(recorder).markCaptured(refusal);
        verify(targetRepository, times(1)).load(any(), any());
    }

    @Test
    void recordsAFailureAndRethrowsIt() {
        RuntimeException failure = new RuntimeException("Fleet did not answer");

        assertThatThrownBy(() -> capture.run(AuditAction.FLEET_POLICY_DELETE, "policy-1", () -> {
            throw failure;
        })).isSameAs(failure);

        AuditEntry entry = recordedEntry();
        assertThat(entry.getOutcome()).isEqualTo(AuditOutcome.FAILURE);
        assertThat(entry.getReason()).isEqualTo("RuntimeException");
        assertThat(entry.getTargetId()).isEqualTo("policy-1");
        assertThat(entry.getTargetName()).isNull();
    }

    @Test
    void keepsTheActionWorkingWhenTheTargetReadFails() {
        when(targetRepository.load(anyList(), eq(TICKET_ID)))
                .thenThrow(new DataAccessResourceFailureException("mongo down"));

        String result = capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        assertThat(result).isEqualTo("archived");
        AuditEntry entry = recordedEntry();
        assertThat(entry.getTargetId()).isEqualTo(TICKET_ID);
        assertThat(entry.getTargetName()).isNull();
    }

    @Test
    void keepsTheActionWorkingWhenRecordingFails() {
        doThrow(new IllegalStateException("broken recorder")).when(recorder).recordCaptured(any(), any());

        String result = capture.run(AuditAction.FLEET_POLICY_DELETE, "policy-1", () -> "deleted");

        assertThat(result).isEqualTo("deleted");
    }

    @Test
    void namesTheFactInsteadOfComparingWhenTheChangeLivesElsewhere() {
        when(targetRepository.load(anyList(), eq(TICKET_ID)))
                .thenReturn(Optional.of(new LoadedTarget(TICKET_TARGET, ticket("Printer offline"))));

        capture.runWithoutCompare(AuditAction.TICKET_TAG_ADD, AuditTargetType.TICKET, TICKET_ID,
                Map.of("tagId", "tag-1"), () -> null);

        AuditEntry entry = recordedEntry();
        assertThat(entry.getChanges()).isNull();
        assertThat(entry.getDetails()).containsExactly(Map.entry("tagId", "tag-1"));
        assertThat(entry.getTargetName()).isEqualTo("Printer offline");
        verify(targetRepository, times(1)).load(any(), any());
    }

    @Test
    void recordsAChangeOnlyWhenTheWorkSaysItHappened() {
        lenient().when(targetRepository.load(anyList(), eq(TICKET_ID))).thenReturn(Optional.empty());

        boolean unchanged = capture.runWhenChanged(AuditAction.TICKET_TAG_ADD, AuditTargetType.TICKET, TICKET_ID,
                Map.of(), () -> false);
        assertThat(unchanged).isFalse();
        verify(recorder, never()).recordCaptured(any(), any());

        boolean changed = capture.runWhenChanged(AuditAction.TICKET_TAG_ADD, AuditTargetType.TICKET, TICKET_ID,
                Map.of(), () -> true);
        assertThat(changed).isTrue();
        verify(recorder).recordCaptured(any(), any());
    }

    @Test
    void recordsASensitiveReadOncePerRequest() {
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(new MockHttpServletRequest()));
        when(targetRepository.load(anyList(), eq(TICKET_ID)))
                .thenReturn(Optional.of(new LoadedTarget(TICKET_TARGET, ticket("Printer offline"))));

        capture.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");
        capture.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");

        AuditEntry entry = recordedEntry();
        assertThat(entry.getChanges()).isNull();
        assertThat(entry.getTargetName()).isEqualTo("Printer offline");
    }

    @Test
    void runsAnActionWithSeveralTargetKindsAndNoTargetTypeUnaudited() {
        assertThat(capture.run(AuditAction.LINK_CREATE, "link-1", () -> "done")).isEqualTo("done");
        verifyNoInteractions(targetRepository, recorder);
    }

    private void stored(Ticket before, Ticket after) {
        when(targetRepository.load(anyList(), eq(TICKET_ID)))
                .thenReturn(Optional.of(new LoadedTarget(TICKET_TARGET, before)))
                .thenReturn(Optional.of(new LoadedTarget(TICKET_TARGET, after)));
    }

    private AuditEntry recordedEntry() {
        verify(recorder).recordCaptured(entryCaptor.capture(), any());
        return entryCaptor.getValue();
    }

    private static Ticket ticket(String title) {
        Ticket ticket = new Ticket();
        ticket.setTitle(title);
        ticket.setOrganizationId("org-1");
        ticket.setDeviceId("device-1");
        return ticket;
    }

    private static Document fields(String statusKind, String description, String lastActivityAt) {
        return new Document("_id", TICKET_ID)
                .append("statusKind", statusKind)
                .append("description", description)
                .append("lastActivityAt", lastActivityAt)
                .append("updatedAt", lastActivityAt);
    }
}
