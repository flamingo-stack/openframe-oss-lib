package com.openframe.audit;

import com.github.f4b6a3.ulid.Ulid;
import com.openframe.audit.targets.AuditTarget;
import com.openframe.audit.targets.AuditTargetRegistry;
import com.openframe.audit.targets.AuditTargetRepository;
import com.openframe.audit.targets.LoadedTarget;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.model.audit.AuditRequestInfo;
import org.bson.Document;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.mapping.MappingException;
import org.springframework.expression.spel.SpelEvaluationException;
import org.springframework.expression.spel.SpelMessage;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
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
    private static final List<AuditTarget<?>> TICKET_TARGETS = List.of(TICKET_TARGET);
    private static final String CONNECTION_ID = "connection-1";
    private static final AuditTarget<Document> CONNECTION_TARGET =
            AuditTarget.of(AuditTargetType.DIRECTORY_CONNECTION, Document.class,
                            connection -> connection.getString("name"))
                    .withEnableActions(Map.of("writesEnabled", AuditAction.DIRECTORY_WRITES_ENABLE));
    private static final List<AuditTarget<?>> CONNECTION_TARGETS = List.of(CONNECTION_TARGET);
    private static final ActionOutcome SUCCEEDED = new ActionOutcome(AuditOutcome.SUCCESS, null);
    private static final AuditContext REQUEST_CONTEXT = new AuditContext(AuditActor.staff("staff-1"),
            new AuditRequestInfo("203.0.113.1", "Chrome", "request-1", "session-1"), null);

    @Mock private AuditTargetRegistry targets;
    @Mock private AuditTargetRepository targetRepository;
    @Mock private AuditOutcomeResolver outcomeResolver;
    @Mock private AuditRecorder recorder;
    @Mock private Runnable work;
    @Captor private ArgumentCaptor<AuditEntry> entryCaptor;
    @Captor private ArgumentCaptor<AuditContext> contextCaptor;
    @Captor private ArgumentCaptor<AuditContext> declaredCaptor;

    private AuditCapture capture;

    @BeforeEach
    void setUp() {
        capture = new AuditCapture(targets, targetRepository, outcomeResolver, recorder, true);
    }

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void run_updateChangedAField_recordsTheChangeWithItsValuesBeforeAndAfter() {
        ticketIdKnown();
        runsTheWork();
        succeeds("archived");
        updated(new Document("statusKind", "OPEN"), new Document("statusKind", "ARCHIVED"));

        String result = capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        assertThat(result).isEqualTo("archived");
        AuditEntry entry = recordedEntry();
        assertThat(entry)
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getTargetType,
                        AuditEntry::getTargetId, AuditEntry::getDetails)
                .containsExactly(AuditAction.TICKET_ARCHIVE, AuditOutcome.SUCCESS, AuditTargetType.TICKET, TICKET_ID,
                        null);
        assertThat(entry.getChanges()).containsExactly(Map.entry("statusKind", new AuditChange("OPEN", "ARCHIVED")));
    }

    @Test
    void run_maskedFieldChanged_hidesBothValues() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        updated(new Document("description", "old text"), new Document("description", "new text"));

        capture.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(recordedEntry().getChanges())
                .containsExactly(Map.entry("description", new AuditChange("[changed]", "[changed]")));
    }

    @Test
    void run_onlyAFieldTheTargetIgnoresChanged_marksNoChange() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        updated(new Document("lastActivityAt", "10:00"), new Document("lastActivityAt", "10:05"));

        capture.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getChanges, AuditEntry::getDetails)
                .containsExactly(null, Map.of("noChange", true));
    }

    @ParameterizedTest
    @ValueSource(strings = {"_id", "_class", "updatedAt", "version", "statusChangedAt", "lastModifiedBy"})
    void run_onlyATechnicalFieldChanged_marksNoChange(String field) {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        updated(new Document(field, "v1"), new Document(field, "v2"));

        capture.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getChanges, AuditEntry::getDetails)
                .containsExactly(null, Map.of("noChange", true));
    }

    @Test
    void run_fieldAddedAndAnotherRemoved_recordsTheMissingSidesAsNull() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        updated(new Document("phone", "555-0100"), new Document("email", "help@acme.test"));

        capture.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(recordedEntry().getChanges()).containsOnly(
                Map.entry("phone", new AuditChange("555-0100", null)),
                Map.entry("email", new AuditChange(null, "help@acme.test")));
    }

    @Test
    void run_compareFails_recordsTheEventWithoutChangesOrNoChangeMark() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        Ticket before = ticket("Printer offline", "org-1", "device-1");
        stored(before, ticket("Printer offline, edited", "org-1", "device-1"));
        when(targetRepository.storedFieldsOf(before)).thenThrow(new MappingException("No converter for status"));

        String result = capture.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(result).isEqualTo("saved");
        assertThat(recordedEntry())
                .extracting(AuditEntry::getAction, AuditEntry::getChanges, AuditEntry::getDetails)
                .containsExactly(AuditAction.TICKET_UPDATE, null, null);
    }

    @Test
    void run_updateRenamedAndMovedTheTarget_takesNameCustomerAndDeviceFromTheCopyAfterTheCall() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        stored(ticket("Printer offline", "org-1", "device-1"), ticket("Lobby printer offline", "org-2", "device-2"));

        capture.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly("Lobby printer offline", "org-2", "device-2");
    }

    @Test
    void run_resultTheResolverRefuses_recordsTheRefusalAndReturnsTheResult() {
        runsTheWork();
        when(outcomeResolver.ofResult("locked"))
                .thenReturn(new ActionOutcome(AuditOutcome.REFUSED, "Ticket is locked"));

        String result = capture.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "locked");

        assertThat(result).isEqualTo("locked");
        assertThat(recordedEntry())
                .extracting(AuditEntry::getOutcome, AuditEntry::getReason)
                .containsExactly(AuditOutcome.REFUSED, "Ticket is locked");
    }

    @Test
    void run_updateChangedNothing_marksNoChange() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        updated(new Document("statusKind", "OPEN"), new Document("statusKind", "OPEN"));

        capture.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getChanges, AuditEntry::getDetails)
                .containsExactly(null, Map.of("noChange", true));
    }

    @Test
    void run_withARequestContext_recordsTheEventUnderIt() {
        runsTheWork();
        succeeds("archived");
        when(recorder.context()).thenReturn(REQUEST_CONTEXT);

        capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        verify(recorder).recordCaptured(any(), contextCaptor.capture());
        assertThat(contextCaptor.getValue()).isEqualTo(REQUEST_CONTEXT);
    }

    @Test
    void run_withARequestContext_declaresTheEventsUlidAsParentToTheWork() {
        runsTheWork();
        succeeds("archived");
        when(recorder.context()).thenReturn(REQUEST_CONTEXT);

        capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        String eventId = recordedEntry().getId();
        assertThat(Ulid.isValid(eventId)).isTrue();
        assertThat(declaredContext()).isEqualTo(REQUEST_CONTEXT.withCurrentEventId(eventId));
    }

    @Test
    void run_contextFails_recordsTheEventWithoutContext() {
        runsTheWork();
        succeeds("archived");
        when(recorder.context()).thenThrow(new IllegalStateException("No user id in the token"));

        String result = capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        assertThat(result).isEqualTo("archived");
        verify(recorder).recordCaptured(entryCaptor.capture(), contextCaptor.capture());
        assertThat(entryCaptor.getValue().getAction()).isEqualTo(AuditAction.TICKET_ARCHIVE);
        assertThat(contextCaptor.getValue()).isNull();
    }

    @Test
    void capture_targetIdInTheResult_recordsTheCreatedTargetReadOnceAfterTheCall() {
        runsTheWork();
        succeeds("ticket-2");
        when(targets.find(AuditTargetType.TICKET)).thenReturn(TICKET_TARGETS);
        when(targetRepository.load(TICKET_TARGETS, "ticket-2"))
                .thenReturn(loaded(ticket("New ticket", "org-1", "device-1")));

        String result = capture.capture(ticketIdInResult(), () -> "ticket-2");

        assertThat(result).isEqualTo("ticket-2");
        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetId, AuditEntry::getTargetName, AuditEntry::getChanges)
                .containsExactly("ticket-2", "New ticket", null);
        verify(targetRepository).load(any(), any());
    }

    @Test
    void capture_targetIdInTheResult_neverNamesTheServedTenantBeforeTheCall() {
        capture.capture(ticketIdInResult(), () -> "ticket-2");

        verify(recorder, never()).targetIdOf(AuditTargetType.TICKET, null);
    }

    @Test
    void run_noTargetId_recordsTheIdTheRecorderNames() {
        runsTheWork();
        succeeds("enabled");
        when(recorder.targetIdOf(AuditTargetType.TENANT, null)).thenReturn("tenant-1");

        capture.run(AuditAction.REMOTE_RECORDING_ENABLE, null, () -> "enabled");

        assertThat(recordedEntry().getTargetId()).isEqualTo("tenant-1");
    }

    @Test
    void capture_targetIdExpressionFails_recordsTheEventAndReturnsTheResult() {
        runsTheWork();
        succeeds("added");
        AuditCall call = taggedTicket().withTargetIdBeforeCall(() -> {
            throw expressionFailure();
        });

        String result = capture.capture(call, () -> "added");

        assertThat(result).isEqualTo("added");
        assertThat(recordedEntry())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId)
                .containsExactly(AuditAction.TICKET_TAG_ADD, null);
    }

    @Test
    void capture_targetIdFromTheResultFails_recordsTheEventAndReturnsTheResult() {
        runsTheWork();
        succeeds("ticket-2");
        AuditCall call = ticketIdInResult().withTargetIdFromResult(_ -> {
            throw expressionFailure();
        });

        String result = capture.capture(call, () -> "ticket-2");

        assertThat(result).isEqualTo("ticket-2");
        assertThat(recordedEntry())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId)
                .containsExactly(AuditAction.TICKET_CREATE, null);
    }

    @Test
    void run_targetGoneAfterTheCall_namesItFromTheCopyBeforeTheCall() {
        ticketIdKnown();
        runsTheWork();
        succeeds("archived");
        stored(ticket("Printer offline", "org-1", "device-1"), null);

        capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly("Printer offline", "org-1", "device-1");
    }

    @Test
    void run_workThrows_recordsItsOutcomeAndRethrowsIt() {
        runsTheWork();
        ForbiddenException refusal = refusedByTheResolver();

        assertThatThrownBy(() -> capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> {
            throw refusal;
        })).isSameAs(refusal);

        assertThat(recordedEntry())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getReason)
                .containsExactly(AuditAction.TICKET_ARCHIVE, AuditOutcome.REFUSED, "Only admins can archive tickets");
    }

    @Test
    void run_workThrows_marksTheFailureCaptured() {
        runsTheWork();
        RuntimeException failure = new RuntimeException("Fleet did not answer");

        assertThatThrownBy(() -> capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> {
            throw failure;
        })).isSameAs(failure);

        verify(recorder).markCaptured(failure);
    }

    @Test
    void run_workThrowsAfterTheReadBefore_namesTheTargetFromThatRead() {
        ticketIdKnown();
        runsTheWork();
        stored(ticket("Printer offline", "org-1", "device-1"));
        ForbiddenException refusal = refusedByTheResolver();

        assertThatThrownBy(() -> capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> {
            throw refusal;
        })).isSameAs(refusal);

        assertThat(recordedEntry().getTargetName()).isEqualTo("Printer offline");
        verify(targetRepository).load(TICKET_TARGETS, TICKET_ID);
    }

    @Test
    void run_workThrows_givesTheFailureEventTheIdDeclaredToTheWork() {
        runsTheWork();
        when(recorder.context()).thenReturn(REQUEST_CONTEXT);
        RuntimeException failure = new RuntimeException("Fleet did not answer");
        when(outcomeResolver.ofFailure(failure))
                .thenReturn(new ActionOutcome(AuditOutcome.FAILURE, "RuntimeException"));

        assertThatThrownBy(() -> capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> {
            throw failure;
        })).isSameAs(failure);

        assertThat(recordedEntry().getId()).isEqualTo(declaredContext().currentEventId());
    }

    @Test
    void runWithoutCompare_workThrows_namesTheTargetFromAReadAfterTheFailure() {
        ticketIdKnown();
        runsTheWork();
        stored(ticket("Printer offline", "org-1", "device-1"));
        IllegalStateException refusal = new IllegalStateException("Tag already added");
        when(outcomeResolver.ofFailure(refusal))
                .thenReturn(new ActionOutcome(AuditOutcome.REFUSED, "Tag already added"));

        assertThatThrownBy(() -> capture.runWithoutCompare(AuditAction.TICKET_TAG_ADD, AuditTargetType.TICKET,
                TICKET_ID, Map.of("tagId", "tag-1"), () -> {
                    throw refusal;
                })).isSameAs(refusal);

        assertThat(recordedEntry().getTargetName()).isEqualTo("Printer offline");
    }

    @Test
    void run_targetReadFails_recordsTheEventWithoutItsName() {
        ticketIdKnown();
        runsTheWork();
        succeeds("archived");
        when(targets.find(AuditTargetType.TICKET)).thenReturn(TICKET_TARGETS);
        when(targetRepository.load(TICKET_TARGETS, TICKET_ID))
                .thenThrow(new DataAccessResourceFailureException("Mongo primary unavailable"));

        String result = capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        assertThat(result).isEqualTo("archived");
        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetId, AuditEntry::getTargetName)
                .containsExactly(TICKET_ID, null);
    }

    @Test
    void run_recordingFails_returnsTheResult() {
        runsTheWork();
        succeeds("archived");
        when(recorder.recordCaptured(any(), any())).thenThrow(new IllegalStateException("Recorder failed"));

        String result = capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        assertThat(result).isEqualTo("archived");
    }

    @Test
    void runWithoutCompare_supplier_recordsTheNamedDetailsFromOneReadAfterTheCall() {
        ticketIdKnown();
        runsTheWork();
        succeeds("added");
        stored(ticket("Printer offline", "org-1", "device-1"));

        String result = capture.runWithoutCompare(AuditAction.TICKET_TAG_ADD, AuditTargetType.TICKET, TICKET_ID,
                Map.of("tagId", "tag-1"), () -> "added");

        assertThat(result).isEqualTo("added");
        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getDetails)
                .containsExactly("Printer offline", Map.of("tagId", "tag-1"));
        verify(targetRepository).load(TICKET_TARGETS, TICKET_ID);
    }

    @Test
    void runWithoutCompare_runnable_runsTheWorkAndRecordsTheEvent() {
        runsTheWork();
        succeeds(null);

        capture.runWithoutCompare(AuditAction.TICKET_TAG_REMOVE, AuditTargetType.TICKET, TICKET_ID,
                Map.of("tagId", "tag-1"), work);

        verify(work).run();
        assertThat(recordedEntry())
                .extracting(AuditEntry::getAction, AuditEntry::getDetails)
                .containsExactly(AuditAction.TICKET_TAG_REMOVE, Map.of("tagId", "tag-1"));
    }

    @Test
    void runWhenChanged_workReportsNoChange_recordsNothing() {
        ticketIdKnown();
        runsTheWork();

        boolean changed = capture.runWhenChanged(AuditAction.TICKET_TAG_ADD, AuditTargetType.TICKET, TICKET_ID,
                Map.of("tagId", "tag-1"), () -> false);

        assertThat(changed).isFalse();
        verifyNoInteractions(targetRepository, outcomeResolver);
        verify(recorder, never()).recordCaptured(any(), any());
    }

    @Test
    void runWhenChanged_workReportsAChange_recordsTheEventFromOneReadAfterTheCall() {
        ticketIdKnown();
        runsTheWork();
        succeeds(true);
        when(targets.find(AuditTargetType.TICKET)).thenReturn(TICKET_TARGETS);

        boolean changed = capture.runWhenChanged(AuditAction.TICKET_TAG_ADD, AuditTargetType.TICKET, TICKET_ID,
                Map.of("tagId", "tag-1"), () -> true);

        assertThat(changed).isTrue();
        assertThat(recordedEntry())
                .extracting(AuditEntry::getAction, AuditEntry::getDetails)
                .containsExactly(AuditAction.TICKET_TAG_ADD, Map.of("tagId", "tag-1"));
        verify(targetRepository).load(TICKET_TARGETS, TICKET_ID);
    }

    @Test
    void capture_conditionFails_recordsTheEvent() {
        runsTheWork();
        succeeds("added");
        AuditCall call = taggedTicket().withRecordsResult(_ -> {
            throw expressionFailure();
        });

        String result = capture.capture(call, () -> "added");

        assertThat(result).isEqualTo("added");
        assertThat(recordedEntry().getAction()).isEqualTo(AuditAction.TICKET_TAG_ADD);
    }

    @Test
    void run_sensitiveRead_readsTheTargetOnlyAfterTheCall() {
        ticketIdKnown();
        runsTheWork();
        succeeds("signed-url");
        stored(ticket("Printer offline", "org-1", "device-1"));

        capture.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");

        assertThat(recordedEntry().getTargetName()).isEqualTo("Printer offline");
        verify(targetRepository).load(TICKET_TARGETS, TICKET_ID);
    }

    @Test
    void run_sameSensitiveReadTwiceInOneRequest_recordsItOnce() {
        inARequest();
        ticketIdKnown();
        runsTheWork();
        succeeds("signed-url");

        capture.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");
        String second = capture.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");

        assertThat(second).isEqualTo("signed-url");
        verify(recorder).recordCaptured(any(), any());
    }

    @Test
    void run_sensitiveReadsOfTwoTargetsInOneRequest_recordsBoth() {
        inARequest();
        runsTheWork();
        succeeds("signed-url");
        when(recorder.targetIdOf(AuditTargetType.TICKET, "ticket-1")).thenReturn("ticket-1");
        when(recorder.targetIdOf(AuditTargetType.TICKET, "ticket-2")).thenReturn("ticket-2");

        capture.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, "ticket-1", () -> "signed-url");
        capture.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, "ticket-2", () -> "signed-url");

        assertThat(recordedEntries()).extracting(AuditEntry::getTargetId).containsExactly("ticket-1", "ticket-2");
    }

    @Test
    void run_sameSensitiveReadTwiceOutsideARequest_recordsBoth() {
        ticketIdKnown();
        runsTheWork();
        succeeds("signed-url");

        capture.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");
        capture.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");

        assertThat(recordedEntries()).extracting(AuditEntry::getTargetId).containsExactly(TICKET_ID, TICKET_ID);
    }

    @Test
    void run_sensitiveReadWithoutTargetIdTwiceInOneRequest_recordsBoth() {
        inARequest();
        runsTheWork();
        succeeds("signed-url");
        when(recorder.targetIdOf(AuditTargetType.TICKET, null)).thenReturn(null);

        capture.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, null, () -> "signed-url");
        capture.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, null, () -> "signed-url");

        assertThat(recordedEntries()).extracting(AuditEntry::getAction)
                .containsExactly(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, AuditAction.TICKET_ATTACHMENT_DOWNLOAD);
    }

    @Test
    void run_auditOff_runsTheWorkWithoutRecording() {
        AuditCapture off = new AuditCapture(targets, targetRepository, outcomeResolver, recorder, false);

        String result = off.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        assertThat(result).isEqualTo("archived");
        verifyNoInteractions(targets, targetRepository, outcomeResolver, recorder);
    }

    @Test
    void run_actionWithoutFixedTargetTypeAndNoneNamed_runsTheWorkWithoutRecording() {
        String result = capture.run(AuditAction.LINK_CREATE, "link-1", () -> "linked");

        assertThat(result).isEqualTo("linked");
        verifyNoInteractions(targets, targetRepository, outcomeResolver, recorder);
    }

    @Test
    void run_runnable_runsTheWorkAndRecordsTheEvent() {
        ticketIdKnown();
        runsTheWork();
        succeeds(null);

        capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, work);

        verify(work).run();
        assertThat(recordedEntry())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetType, AuditEntry::getTargetId)
                .containsExactly(AuditAction.TICKET_ARCHIVE, AuditTargetType.TICKET, TICKET_ID);
    }

    @Test
    void run_runnableWithDetails_recordsTheDetails() {
        runsTheWork();
        succeeds(null);

        capture.run(AuditAction.TICKET_NOTE_ADD, TICKET_ID, Map.of("noteId", "note-1"), work);

        assertThat(recordedEntry().getDetails()).containsExactly(Map.entry("noteId", "note-1"));
    }

    @Test
    void run_runnableWithTargetType_recordsTheNamedTargetType() {
        runsTheWork();
        succeeds(null);
        when(recorder.targetIdOf(AuditTargetType.KB_ARTICLE, "article-1")).thenReturn("article-1");

        capture.run(AuditAction.LINK_CREATE, AuditTargetType.KB_ARTICLE, "article-1", Map.of(), work);

        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetType, AuditEntry::getTargetId)
                .containsExactly(AuditTargetType.KB_ARTICLE, "article-1");
    }

    @Test
    void run_supplierWithDetails_recordsTheDetailsAndReturnsTheResult() {
        runsTheWork();
        succeeds("note-1");

        String result = capture.run(AuditAction.TICKET_NOTE_ADD, TICKET_ID, Map.of("visibility", "internal"),
                () -> "note-1");

        assertThat(result).isEqualTo("note-1");
        assertThat(recordedEntry().getDetails()).containsExactly(Map.entry("visibility", "internal"));
    }

    @Test
    void run_supplierWithTargetType_recordsTheNamedTargetTypeAndReturnsTheResult() {
        runsTheWork();
        succeeds("link-1");

        String result = capture.run(AuditAction.LINK_CREATE, AuditTargetType.KB_ARTICLE, "article-1", Map.of(),
                () -> "link-1");

        assertThat(result).isEqualTo("link-1");
        assertThat(recordedEntry().getTargetType()).isEqualTo(AuditTargetType.KB_ARTICLE);
    }

    @Test
    void capture_detailsReadFromTheResult_recordsThem() {
        runsTheWork();
        succeeds("tag-1");
        AuditCall call = taggedTicket().withDetailsFromResult(result -> Map.of("tagId", result));

        capture.capture(call, () -> "tag-1");

        assertThat(recordedEntry().getDetails()).containsExactly(Map.entry("tagId", "tag-1"));
    }

    @Test
    void capture_detailsExpressionFails_recordsTheEventWithoutDetails() {
        runsTheWork();
        succeeds("added");
        AuditCall call = taggedTicket().withDetailsFromResult(_ -> {
            throw expressionFailure();
        });

        capture.capture(call, () -> "added");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getAction, AuditEntry::getDetails)
                .containsExactly(AuditAction.TICKET_TAG_ADD, null);
    }

    @Test
    void capture_tenantNamedByTheCall_recordsIt() {
        runsTheWork();
        succeeds("added");

        capture.capture(taggedTicket().withTenantIdOf(_ -> "tenant-7"), () -> "added");

        assertThat(recordedEntry().getTenantId()).isEqualTo("tenant-7");
    }

    @Test
    void capture_tenantExpressionFails_recordsTheEventWithoutTenant() {
        runsTheWork();
        succeeds("added");
        AuditCall call = taggedTicket().withTenantIdOf(_ -> {
            throw expressionFailure();
        });

        capture.capture(call, () -> "added");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getAction, AuditEntry::getTenantId)
                .containsExactly(AuditAction.TICKET_TAG_ADD, null);
    }

    @Test
    void capture_storedRecordAndCallBothNameTheTarget_keepsTheStoredValues() {
        ticketIdKnown();
        runsTheWork();
        succeeds("added");
        stored(ticket("Printer offline", "org-1", "device-1"));

        capture.capture(namedByTheCall(taggedTicket()), () -> "added");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly("Printer offline", "org-1", "device-1");
    }

    @Test
    void capture_storedRecordNamesNoCustomerOrDevice_takesThemFromTheCall() {
        ticketIdKnown();
        runsTheWork();
        succeeds("added");
        stored(ticket("Printer offline", null, null));

        capture.capture(namedByTheCall(taggedTicket()), () -> "added");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly("Printer offline", "org-9", "device-9");
    }

    @Test
    void capture_targetWithoutLoader_takesNameCustomerAndDeviceFromTheCall() {
        runsTheWork();
        succeeds("deleted");
        when(recorder.targetIdOf(AuditTargetType.FLEET_POLICY, "policy-1")).thenReturn("policy-1");
        when(targets.find(AuditTargetType.FLEET_POLICY)).thenReturn(List.of());
        when(targetRepository.load(List.of(), "policy-1")).thenReturn(Optional.empty());

        capture.capture(namedByTheCall(AuditCall.of(AuditAction.FLEET_POLICY_DELETE, "policy-1")), () -> "deleted");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly("Disk encryption", "org-9", "device-9");
    }

    @Test
    void capture_targetNameExpressionFails_recordsTheEventWithoutName() {
        ticketIdKnown();
        runsTheWork();
        succeeds("added");
        when(targets.find(AuditTargetType.TICKET)).thenReturn(TICKET_TARGETS);
        when(targetRepository.load(TICKET_TARGETS, TICKET_ID)).thenReturn(Optional.empty());
        AuditCall call = taggedTicket().withTargetNameOf(_ -> {
            throw expressionFailure();
        });

        capture.capture(call, () -> "added");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetName)
                .containsExactly(AuditAction.TICKET_TAG_ADD, null);
    }

    @Test
    void run_updateTurnsAnEnableFieldOn_recordsTheEnableEventUnderTheUpdate() {
        runsTheWork();
        succeeds("saved");
        when(recorder.context()).thenReturn(REQUEST_CONTEXT);
        connectionUpdated(connection(false), connection(true).append("name", "Acme Workspace"));

        capture.run(AuditAction.DIRECTORY_CONNECTION_UPDATE, CONNECTION_ID, () -> "saved");

        verify(recorder, times(2)).recordCaptured(entryCaptor.capture(), contextCaptor.capture());
        String eventId = declaredContext().currentEventId();
        assertThat(entryCaptor.getAllValues())
                .extracting(AuditEntry::getId, AuditEntry::getAction, AuditEntry::getTargetId,
                        AuditEntry::getTargetName)
                .containsExactly(
                        tuple(eventId, AuditAction.DIRECTORY_CONNECTION_UPDATE, CONNECTION_ID, "Acme Workspace"),
                        tuple(null, AuditAction.DIRECTORY_WRITES_ENABLE, CONNECTION_ID, "Acme Workspace"));
        assertThat(contextCaptor.getAllValues())
                .containsExactly(REQUEST_CONTEXT, REQUEST_CONTEXT.withCurrentEventId(eventId));
    }

    @Test
    void run_updateWithTheEnableFieldAlreadyOn_recordsOnlyTheUpdate() {
        runsTheWork();
        succeeds("saved");
        connectionUpdated(connection(true), connection(true).append("rules", "engineering"));

        capture.run(AuditAction.DIRECTORY_CONNECTION_UPDATE, CONNECTION_ID, () -> "saved");

        assertThat(recordedEntry().getAction()).isEqualTo(AuditAction.DIRECTORY_CONNECTION_UPDATE);
    }

    @Test
    void run_updateTurnsAnEnableFieldOff_recordsOnlyTheUpdate() {
        runsTheWork();
        succeeds("saved");
        connectionUpdated(connection(true), connection(false));

        capture.run(AuditAction.DIRECTORY_CONNECTION_UPDATE, CONNECTION_ID, () -> "saved");

        assertThat(recordedEntry().getAction()).isEqualTo(AuditAction.DIRECTORY_CONNECTION_UPDATE);
    }

    @Test
    void run_refusedUpdateTurnsAnEnableFieldOn_recordsOnlyTheUpdate() {
        runsTheWork();
        when(outcomeResolver.ofResult("locked"))
                .thenReturn(new ActionOutcome(AuditOutcome.REFUSED, "Connection is locked"));
        connectionUpdated(connection(false), connection(true));

        capture.run(AuditAction.DIRECTORY_CONNECTION_UPDATE, CONNECTION_ID, () -> "locked");

        assertThat(recordedEntry().getAction()).isEqualTo(AuditAction.DIRECTORY_CONNECTION_UPDATE);
    }

    @Test
    void run_updateWhoseReadBeforeFailed_recordsNoEnableEvent() {
        runsTheWork();
        succeeds("saved");
        when(recorder.targetIdOf(AuditTargetType.DIRECTORY_CONNECTION, CONNECTION_ID)).thenReturn(CONNECTION_ID);
        when(targets.find(AuditTargetType.DIRECTORY_CONNECTION)).thenReturn(CONNECTION_TARGETS);
        Document after = connection(true);
        when(targetRepository.load(CONNECTION_TARGETS, CONNECTION_ID))
                .thenThrow(new DataAccessResourceFailureException("Mongo primary unavailable"))
                .thenReturn(Optional.of(new LoadedTarget(CONNECTION_TARGET, after)));

        capture.run(AuditAction.DIRECTORY_CONNECTION_UPDATE, CONNECTION_ID, () -> "saved");

        assertThat(recordedEntry().getAction()).isEqualTo(AuditAction.DIRECTORY_CONNECTION_UPDATE);
        verify(targetRepository, never()).storedFieldsOf(after);
    }

    @Test
    void capture_createWithTheEnableFieldOn_recordsTheEnableEventToo() {
        runsTheWork();
        succeeds(CONNECTION_ID);
        Document created = storedConnectionWithWritesOn();
        when(targetRepository.storedFieldsOf(created)).thenReturn(created);

        capture.capture(connectionIdInResult(AuditAction.DIRECTORY_CONNECTION_CREATE), () -> CONNECTION_ID);

        assertThat(recordedEntries()).extracting(AuditEntry::getAction)
                .containsExactly(AuditAction.DIRECTORY_CONNECTION_CREATE, AuditAction.DIRECTORY_WRITES_ENABLE);
    }

    @Test
    void capture_otherActionWithTheIdInTheResult_recordsNoEnableEvent() {
        runsTheWork();
        succeeds(CONNECTION_ID);
        Document accepted = storedConnectionWithWritesOn();

        capture.capture(connectionIdInResult(AuditAction.DIRECTORY_CONSENT_ACCEPT), () -> CONNECTION_ID);

        assertThat(recordedEntry().getAction()).isEqualTo(AuditAction.DIRECTORY_CONSENT_ACCEPT);
        verify(targetRepository, never()).storedFieldsOf(accepted);
    }

    private void ticketIdKnown() {
        when(recorder.targetIdOf(AuditTargetType.TICKET, TICKET_ID)).thenReturn(TICKET_ID);
    }

    private void runsTheWork() {
        when(recorder.capturing(any(), any()))
                .thenAnswer(invocation -> invocation.<AuditedWork<Object, RuntimeException>>getArgument(1).run());
    }

    private void succeeds(Object result) {
        when(outcomeResolver.ofResult(result)).thenReturn(SUCCEEDED);
    }

    private ForbiddenException refusedByTheResolver() {
        ForbiddenException refusal = new ForbiddenException("Only admins can archive tickets");
        when(outcomeResolver.ofFailure(refusal))
                .thenReturn(new ActionOutcome(AuditOutcome.REFUSED, "Only admins can archive tickets"));
        return refusal;
    }

    private static void inARequest() {
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(new MockHttpServletRequest()));
    }

    private void stored(Ticket ticket) {
        when(targets.find(AuditTargetType.TICKET)).thenReturn(TICKET_TARGETS);
        when(targetRepository.load(TICKET_TARGETS, TICKET_ID)).thenReturn(loaded(ticket));
    }

    private void stored(Ticket before, Ticket after) {
        when(targets.find(AuditTargetType.TICKET)).thenReturn(TICKET_TARGETS);
        when(targetRepository.load(TICKET_TARGETS, TICKET_ID)).thenReturn(loaded(before), loaded(after));
    }

    private void updated(Document beforeFields, Document afterFields) {
        Ticket before = ticket("Printer offline", "org-1", "device-1");
        Ticket after = ticket("Printer offline, edited", "org-1", "device-1");
        stored(before, after);
        when(targetRepository.storedFieldsOf(before)).thenReturn(beforeFields);
        when(targetRepository.storedFieldsOf(after)).thenReturn(afterFields);
    }

    private Document storedConnectionWithWritesOn() {
        Document connection = connection(true);
        when(targets.find(AuditTargetType.DIRECTORY_CONNECTION)).thenReturn(CONNECTION_TARGETS);
        when(targetRepository.load(CONNECTION_TARGETS, CONNECTION_ID))
                .thenReturn(Optional.of(new LoadedTarget(CONNECTION_TARGET, connection)));
        return connection;
    }

    private void connectionUpdated(Document before, Document after) {
        when(recorder.targetIdOf(AuditTargetType.DIRECTORY_CONNECTION, CONNECTION_ID)).thenReturn(CONNECTION_ID);
        when(targets.find(AuditTargetType.DIRECTORY_CONNECTION)).thenReturn(CONNECTION_TARGETS);
        when(targetRepository.load(CONNECTION_TARGETS, CONNECTION_ID)).thenReturn(
                Optional.of(new LoadedTarget(CONNECTION_TARGET, before)),
                Optional.of(new LoadedTarget(CONNECTION_TARGET, after)));
        when(targetRepository.storedFieldsOf(before)).thenReturn(before);
        when(targetRepository.storedFieldsOf(after)).thenReturn(after);
    }

    private AuditEntry recordedEntry() {
        verify(recorder).recordCaptured(entryCaptor.capture(), any());
        return entryCaptor.getValue();
    }

    private List<AuditEntry> recordedEntries() {
        verify(recorder, times(2)).recordCaptured(entryCaptor.capture(), any());
        return entryCaptor.getAllValues();
    }

    private AuditContext declaredContext() {
        verify(recorder).capturing(declaredCaptor.capture(), any());
        return declaredCaptor.getValue();
    }

    private static AuditCall taggedTicket() {
        return AuditCall.of(AuditAction.TICKET_TAG_ADD, AuditTargetType.TICKET, TICKET_ID, Map.of())
                .withCompare(false);
    }

    private static AuditCall namedByTheCall(AuditCall call) {
        return call.withTargetNameOf(_ -> "Disk encryption")
                .withOrganizationIdOf(_ -> "org-9")
                .withDeviceIdOf(_ -> "device-9");
    }

    private static AuditCall ticketIdInResult() {
        return AuditCall.of(AuditAction.TICKET_CREATE, AuditTargetType.TICKET, null, Map.of())
                .withTargetIdFromResult(String.class::cast)
                .withTargetIdInResult(true);
    }

    private static AuditCall connectionIdInResult(AuditAction action) {
        return AuditCall.of(action, AuditTargetType.DIRECTORY_CONNECTION, null, Map.of())
                .withTargetIdFromResult(String.class::cast)
                .withTargetIdInResult(true);
    }

    private static SpelEvaluationException expressionFailure() {
        return new SpelEvaluationException(SpelMessage.PROPERTY_OR_FIELD_NOT_READABLE_ON_NULL, "id");
    }

    private static Optional<LoadedTarget> loaded(Ticket ticket) {
        return Optional.ofNullable(ticket).map(found -> new LoadedTarget(TICKET_TARGET, found));
    }

    private static Ticket ticket(String title, String organizationId, String deviceId) {
        Ticket ticket = new Ticket();
        ticket.setTitle(title);
        ticket.setOrganizationId(organizationId);
        ticket.setDeviceId(deviceId);
        return ticket;
    }

    private static Document connection(boolean writesEnabled) {
        return new Document("name", "Acme Google").append("writesEnabled", writesEnabled);
    }
}
