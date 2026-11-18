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
import org.bson.types.Decimal128;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Captor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditedMethodRunnerTest {

    private static final String TICKET_ID = "ticket-1";
    private static final AuditTarget<Ticket> TICKET_TARGET =
            AuditTarget.of(AuditTargetType.TICKET, Ticket.class, Ticket::getTitle)
                    .withOrganizationId(Ticket::getOrganizationId)
                    .withDeviceId(Ticket::getDeviceId)
                    .withIgnoredFields(Set.of("lastActivityAt"))
                    .withMaskedFields(Set.of("description", "consents.nonce"));
    private static final List<AuditTarget<?>> TICKET_TARGETS = List.of(TICKET_TARGET);
    private static final String CONNECTION_ID = "connection-1";
    private static final AuditTarget<Document> CONNECTION_TARGET =
            AuditTarget.of(AuditTargetType.DIRECTORY_CONNECTION, Document.class,
                            connection -> connection.getString("name"))
                    .withChildActions(Map.of("writesEnabled", AuditAction.DIRECTORY_WRITES_ENABLE));
    private static final List<AuditTarget<?>> CONNECTION_TARGETS = List.of(CONNECTION_TARGET);
    private static final ActionOutcome SUCCEEDED = new ActionOutcome(AuditOutcome.SUCCESS, null);
    private static final AuditContext REQUEST_CONTEXT = new AuditContext(AuditActor.staff("staff-1"),
            new AuditRequestInfo("203.0.113.1", "Chrome", "request-1", "session-1"), null);

    @Mock private AuditTargetRegistry targets;
    @Mock private AuditTargetRepository targetRepository;
    @Mock private AuditOutcomeResolver outcomeResolver;
    @Mock private AuditRecorder recorder;
    @Mock private AuditEventWriter writer;
    @Mock private AuditDocumentConverter documentConverter;
    @Captor private ArgumentCaptor<AuditEntry> entryCaptor;
    @Captor private ArgumentCaptor<AuditContext> contextCaptor;
    @Captor private ArgumentCaptor<AuditContext> declaredCaptor;

    private AuditedMethodRunner runner;
    private int detailReads;

    @BeforeEach
    void setUp() {
        runner = new AuditedMethodRunner(targets, targetRepository, outcomeResolver, recorder, writer, documentConverter, true);
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

        String result = runner.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

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

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(recordedEntry().getChanges())
                .containsExactly(Map.entry("description", new AuditChange("[changed]", "[changed]")));
    }

    @Test
    void run_onlyAFieldTheTargetIgnoresChanged_recordsNothingAndReturnsTheResult() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        updated(new Document("lastActivityAt", "10:00"), new Document("lastActivityAt", "10:05"));

        noChildrenRecorded();

        String result = runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(result).isEqualTo("saved");
        verify(recorder, never()).recordAudited(any(), any());
    }

    @Test
    void run_onlyTheVersionCounterChanged_recordsNothing() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        updated(new Document("version", 1L), new Document("version", 2L));

        noChildrenRecorded();

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        verify(recorder, never()).recordAudited(any(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"_id", "updatedAt", "statusChangedAt", "lastModifiedBy", "updatedBy"})
    void run_onlyATechnicalFieldChanged_recordsNothing(String field) {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        updated(new Document(field, "v1"), new Document(field, "v2"));

        noChildrenRecorded();

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        verify(recorder, never()).recordAudited(any(), any());
    }

    @Test
    void run_fieldNamedVersionThatIsNotTheVersionCounterChanged_recordsTheChange() {
        runsTheWork();
        succeeds("saved");
        connectionUpdated(connection(true).append("version", "BETA"), connection(true).append("version", "PROD"));

        runner.run(AuditAction.DIRECTORY_CONNECTION_UPDATE, CONNECTION_ID, () -> "saved");

        assertThat(recordedEntry().getChanges()).containsExactly(Map.entry("version", new AuditChange("BETA", "PROD")));
    }

    @Test
    void run_fieldAddedAndAnotherRemoved_recordsTheMissingSidesAsNull() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        updated(new Document("phone", "555-0100"), new Document("email", "help@acme.test"));

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(recordedEntry().getChanges()).containsExactly(
                Map.entry("email", new AuditChange(null, "help@acme.test")),
                Map.entry("phone", new AuditChange("555-0100", null)));
    }

    @Test
    void run_updateRenamedAndMovedTheTarget_takesNameCustomerAndDeviceFromTheCopyAfterTheCall() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        Ticket before = ticket("Printer offline", "org-1", "device-1");
        Ticket after = ticket("Lobby printer offline", "org-2", "device-2");
        stored(before, after);
        writesFields(before, new Document("title", "Printer offline"));
        writesFields(after, new Document("title", "Lobby printer offline"));

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly("Lobby printer offline", "org-2", "device-2");
    }

    @Test
    void run_updateChangedNothing_recordsNothing() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        updated(new Document("statusKind", "OPEN"), new Document("statusKind", "OPEN"));

        noChildrenRecorded();

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        verify(recorder, never()).recordAudited(any(), any());
    }

    @Test
    void run_updateChangedNothingButAnEventWasRecordedUnderIt_recordsTheEvent() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        updated(new Document("statusKind", "OPEN"), new Document("statusKind", "OPEN"));
        when(writer.hadChildren(any())).thenReturn(true);

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        AuditEntry entry = recordedEntry();
        assertThat(entry).extracting(AuditEntry::getAction, AuditEntry::getChanges)
                .containsExactly(AuditAction.TICKET_UPDATE, null);
        verify(writer).hadChildren(entry.getId());
    }

    @Test
    void run_updateRefusedInItsResultChangedNothing_recordsTheRefusal() {
        ticketIdKnown();
        runsTheWork();
        when(outcomeResolver.ofResult("refused"))
                .thenReturn(new ActionOutcome(AuditOutcome.REFUSED, "Ticket is archived"));
        updated(new Document("statusKind", "OPEN"), new Document("statusKind", "OPEN"));

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "refused");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getOutcome, AuditEntry::getReason, AuditEntry::getChanges)
                .containsExactly(AuditOutcome.REFUSED, "Ticket is archived", null);
    }

    @Test
    void run_withARequestContext_declaresTheEventsUlidAsParentToTheWork() {
        runsTheWork();
        succeeds("archived");
        when(recorder.context()).thenReturn(REQUEST_CONTEXT);

        runner.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        String eventId = recordedEntry().getId();
        assertThat(Ulid.isValid(eventId)).isTrue();
        assertThat(declaredContext()).isEqualTo(REQUEST_CONTEXT.withParentEventId(eventId));
    }

    @Test
    void run_targetIdInTheResult_recordsTheCreatedTargetReadOnceAfterTheCall() {
        runsTheWork();
        succeeds("ticket-2");
        when(targets.find(AuditTargetType.TICKET)).thenReturn(TICKET_TARGETS);
        when(targetRepository.load(TICKET_TARGETS, "ticket-2"))
                .thenReturn(loaded(ticket("New ticket", "org-1", "device-1")));

        String result = runner.run(ticketIdInResult(), () -> "ticket-2");

        assertThat(result).isEqualTo("ticket-2");
        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetId, AuditEntry::getTargetName, AuditEntry::getChanges)
                .containsExactly("ticket-2", "New ticket", null);
        verifyTheTargetWasReadOnceAfterTheWork("ticket-2");
    }

    @Test
    void run_targetIdInTheResult_takesTheIdFromTheResultNotFromTheServedTenant() {
        runsTheWork();
        succeeds("ticket-2");
        lenient().when(writer.targetIdOf(AuditTargetType.TICKET, null)).thenReturn("tenant-1");

        runner.run(ticketIdInResult(), () -> "ticket-2");

        assertThat(recordedEntry().getTargetId()).isEqualTo("ticket-2");
    }

    @Test
    void run_targetTypeWithTwoRecordKinds_readsItAfterTheCallOnlyAsTheKindFoundBefore() {
        AuditTarget<Document> otherKind = AuditTarget.of(AuditTargetType.TICKET, Document.class, _ -> null);
        List<AuditTarget<?>> twoKinds = List.of(otherKind, TICKET_TARGET);
        Ticket before = ticket("Printer offline", "org-1", "device-1");
        Ticket after = ticket("Printer offline, edited", "org-1", "device-1");
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        when(targets.find(AuditTargetType.TICKET)).thenReturn(twoKinds);
        when(targetRepository.load(twoKinds, TICKET_ID)).thenReturn(loaded(before));
        when(targetRepository.load(TICKET_TARGETS, TICKET_ID)).thenReturn(loaded(after));
        writesFields(before, new Document("title", "Printer offline"));
        writesFields(after, new Document("title", "Printer offline, edited"));

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(recordedEntry().getTargetName()).isEqualTo("Printer offline, edited");
        verify(targetRepository).load(twoKinds, TICKET_ID);
    }

    @Test
    void run_targetGoneAfterTheCall_namesItFromTheCopyBeforeTheCall() {
        ticketIdKnown();
        runsTheWork();
        succeeds("archived");
        stored(ticket("Printer offline", "org-1", "device-1"), null);

        runner.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly("Printer offline", "org-1", "device-1");
    }

    @Test
    void run_workThrows_recordsItsOutcomeAndRethrowsIt() {
        runsTheWork();
        ForbiddenException refusal = refusedByTheResolver();

        assertThatThrownBy(() -> runner.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> {
            throw refusal;
        })).isSameAs(refusal);

        assertThat(recordedEntry())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getReason)
                .containsExactly(AuditAction.TICKET_ARCHIVE, AuditOutcome.REFUSED, "Only admins can archive tickets");
    }

    @Test
    void run_workThrowsAfterChangingTheTarget_recordsTheFailureWithTheChangedFields() {
        ticketIdKnown();
        runsTheWork();
        updated(new Document("statusKind", "OPEN"), new Document("statusKind", "ARCHIVED"));
        ForbiddenException refusal = refusedByTheResolver();

        assertThatThrownBy(() -> runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> {
            throw refusal;
        })).isSameAs(refusal);

        assertThat(recordedEntry())
                .extracting(AuditEntry::getOutcome, AuditEntry::getTargetName, AuditEntry::getChanges)
                .containsExactly(AuditOutcome.REFUSED, "Printer offline, edited",
                        Map.of("statusKind", new AuditChange("OPEN", "ARCHIVED")));
    }

    @Test
    void run_workThrowsBeforeChangingTheTarget_recordsTheFailureWithoutChanges() {
        ticketIdKnown();
        runsTheWork();
        updated(new Document("statusKind", "OPEN"), new Document("statusKind", "OPEN"));
        ForbiddenException refusal = refusedByTheResolver();

        assertThatThrownBy(() -> runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> {
            throw refusal;
        })).isSameAs(refusal);

        assertThat(recordedEntry())
                .extracting(AuditEntry::getOutcome, AuditEntry::getChanges)
                .containsExactly(AuditOutcome.REFUSED, null);
    }

    @Test
    void alreadyRecorded_failureOfAuditedWork_isTrue() {
        runsTheWork();
        ForbiddenException refusal = refusedByTheResolver();
        when(recorder.recordAudited(any(), any())).thenReturn(true);

        assertThatThrownBy(() -> runner.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> {
            throw refusal;
        })).isSameAs(refusal);

        assertThat(runner.alreadyRecorded(refusal)).isTrue();
    }

    @Test
    void alreadyRecorded_failureWhoseEventWasNotStored_isFalse() {
        runsTheWork();
        ForbiddenException refusal = refusedByTheResolver();
        when(recorder.recordAudited(any(), any())).thenReturn(false);

        assertThatThrownBy(() -> runner.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> {
            throw refusal;
        })).isSameAs(refusal);

        assertThat(runner.alreadyRecorded(refusal)).isFalse();
    }

    @Test
    void run_workThrowsAndTheTargetIsGoneAfterIt_namesTheTargetFromTheReadBefore() {
        ticketIdKnown();
        runsTheWork();
        stored(ticket("Printer offline", "org-1", "device-1"), null);
        ForbiddenException refusal = refusedByTheResolver();

        assertThatThrownBy(() -> runner.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> {
            throw refusal;
        })).isSameAs(refusal);

        assertThat(recordedEntry().getTargetName()).isEqualTo("Printer offline");
    }

    @Test
    void run_workThrows_givesTheFailureEventTheIdDeclaredToTheWork() {
        runsTheWork();
        when(recorder.context()).thenReturn(REQUEST_CONTEXT);
        RuntimeException failure = new RuntimeException("Fleet did not answer");
        when(outcomeResolver.ofFailure(failure))
                .thenReturn(new ActionOutcome(AuditOutcome.FAILURE, "RuntimeException"));

        assertThatThrownBy(() -> runner.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> {
            throw failure;
        })).isSameAs(failure);

        assertThat(recordedEntry().getId()).isEqualTo(declaredContext().parentEventId());
    }

    @Test
    void runWithoutCompare_workThrows_namesTheTargetFromAReadAfterTheFailure() {
        ticketIdKnown();
        runsTheWork();
        stored(ticket("Printer offline", "org-1", "device-1"));
        IllegalStateException refusal = new IllegalStateException("Tag already added");
        when(outcomeResolver.ofFailure(refusal))
                .thenReturn(new ActionOutcome(AuditOutcome.REFUSED, "Tag already added"));

        assertThatThrownBy(() -> runner.runWithoutCompare(AuditAction.TICKET_TAG_ADD, AuditTargetType.TICKET,
                TICKET_ID, Map.of("tagId", "tag-1"), () -> {
                    throw refusal;
                })).isSameAs(refusal);

        assertThat(recordedEntry().getTargetName()).isEqualTo("Printer offline");
        verifyTheTargetWasReadOnceAfterTheWork(TICKET_ID);
    }

    @Test
    void run_targetReadFails_recordsTheEventWithoutItsName() {
        ticketIdKnown();
        runsTheWork();
        succeeds("archived");
        when(targets.find(AuditTargetType.TICKET)).thenReturn(TICKET_TARGETS);
        when(targetRepository.load(TICKET_TARGETS, TICKET_ID))
                .thenThrow(new DataAccessResourceFailureException("Mongo primary unavailable"));

        String result = runner.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        assertThat(result).isEqualTo("archived");
        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetId, AuditEntry::getTargetName)
                .containsExactly(TICKET_ID, null);
    }

    @Test
    void run_recordingFails_returnsTheResult() {
        runsTheWork();
        succeeds("archived");
        when(recorder.recordAudited(any(), any())).thenThrow(new IllegalStateException("Recorder failed"));

        String result = runner.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        assertThat(result).isEqualTo("archived");
    }

    @Test
    void runWithoutCompare_supplier_recordsTheNamedDetailsFromOneReadAfterTheCall() {
        ticketIdKnown();
        runsTheWork();
        succeeds("added");
        stored(ticket("Printer offline", "org-1", "device-1"));

        String result = runner.runWithoutCompare(AuditAction.TICKET_TAG_ADD, AuditTargetType.TICKET, TICKET_ID,
                Map.of("tagId", "tag-1"), () -> "added");

        assertThat(result).isEqualTo("added");
        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getDetails)
                .containsExactly("Printer offline", Map.of("tagId", "tag-1"));
        verifyTheTargetWasReadOnceAfterTheWork(TICKET_ID);
    }

    @Test
    void runWhenChanged_workReportsNoChange_recordsNothing() {
        ticketIdKnown();
        runsTheWork();
        succeeds(false);
        noChildrenRecorded();

        boolean changed = runner.runWhenChanged(AuditAction.TICKET_TAG_ADD, AuditTargetType.TICKET, TICKET_ID,
                Map.of("tagId", "tag-1"), () -> false);

        assertThat(changed).isFalse();
        verifyNoInteractions(targetRepository);
        verify(recorder, never()).recordAudited(any(), any());
    }

    @Test
    void run_conditionNotMetButAnEventWasRecordedUnderIt_recordsTheEvent() {
        runsTheWork();
        succeeds("added");
        when(writer.hadChildren(any())).thenReturn(true);
        AuditCall call = taggedTicket().withRecordsResult(_ -> false);

        runner.run(call, () -> "added");

        assertThat(recordedEntry().getAction()).isEqualTo(AuditAction.TICKET_TAG_ADD);
    }

    @Test
    void run_conditionNotMetButTheResultIsARefusal_recordsTheRefusal() {
        runsTheWork();
        when(outcomeResolver.ofResult("name taken"))
                .thenReturn(new ActionOutcome(AuditOutcome.REFUSED, "Name already taken"));
        AuditCall call = taggedTicket().withRecordsResult(_ -> false);

        runner.run(call, () -> "name taken");

        assertThat(recordedEntry()).extracting(AuditEntry::getOutcome, AuditEntry::getReason)
                .containsExactly(AuditOutcome.REFUSED, "Name already taken");
    }

    @Test
    void runWhenChanged_workReportsAChange_recordsTheEventFromOneReadAfterTheCall() {
        ticketIdKnown();
        runsTheWork();
        succeeds(true);
        when(targets.find(AuditTargetType.TICKET)).thenReturn(TICKET_TARGETS);

        boolean changed = runner.runWhenChanged(AuditAction.TICKET_TAG_ADD, AuditTargetType.TICKET, TICKET_ID,
                Map.of("tagId", "tag-1"), () -> true);

        assertThat(changed).isTrue();
        assertThat(recordedEntry())
                .extracting(AuditEntry::getAction, AuditEntry::getDetails)
                .containsExactly(AuditAction.TICKET_TAG_ADD, Map.of("tagId", "tag-1"));
        verifyTheTargetWasReadOnceAfterTheWork(TICKET_ID);
    }

    @Test
    void run_sensitiveRead_readsTheTargetOnlyAfterTheCall() {
        ticketIdKnown();
        runsTheWork();
        succeeds("signed-url");
        stored(ticket("Printer offline", "org-1", "device-1"));

        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");

        assertThat(recordedEntry().getTargetName()).isEqualTo("Printer offline");
        verifyTheTargetWasReadOnceAfterTheWork(TICKET_ID);
    }

    @Test
    void run_sameSensitiveReadTwiceBySameActorInOneRequest_recordsItOnce() {
        inARequest();
        ticketIdKnown();
        runsTheWork();
        succeeds("signed-url");
        noChildrenRecorded();
        when(recorder.recordAudited(any(), any())).thenReturn(true);
        when(recorder.context()).thenReturn(REQUEST_CONTEXT);

        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");
        String second = runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");

        assertThat(second).isEqualTo("signed-url");
        verify(recorder).recordAudited(any(), any());
    }

    @Test
    void run_sameSensitiveReadByAnotherActorInOneRequest_recordsBoth() {
        inARequest();
        ticketIdKnown();
        runsTheWork();
        succeeds("signed-url");
        when(recorder.recordAudited(any(), any())).thenReturn(true);
        when(recorder.context()).thenReturn(REQUEST_CONTEXT,
                new AuditContext(AuditActor.staff("staff-2"), REQUEST_CONTEXT.requestInfo(), null));

        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");
        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");

        verify(recorder, times(2)).recordAudited(any(), any());
    }

    @Test
    void run_sameSensitiveReadTwiceAndTheFirstEventWasNotStored_recordsItAgain() {
        inARequest();
        ticketIdKnown();
        runsTheWork();
        succeeds("signed-url");
        when(recorder.recordAudited(any(), any())).thenReturn(false);

        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");
        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");

        verify(recorder, times(2)).recordAudited(any(), any());
    }

    @Test
    void run_sameSensitiveReadTwiceAndAnEventWasRecordedUnderTheSecond_recordsBoth() {
        inARequest();
        ticketIdKnown();
        runsTheWork();
        succeeds("signed-url");
        when(recorder.recordAudited(any(), any())).thenReturn(true);
        when(writer.hadChildren(any())).thenReturn(false, true);

        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");
        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");

        verify(recorder, times(2)).recordAudited(any(), any());
    }

    @Test
    void run_sensitiveReadRefusedThenAnsweredInOneRequest_recordsBoth() {
        inARequest();
        ticketIdKnown();
        runsTheWork();
        when(outcomeResolver.ofResult("denied")).thenReturn(new ActionOutcome(AuditOutcome.REFUSED, "Not yours"));
        succeeds("signed-url");
        when(recorder.recordAudited(any(), any())).thenReturn(true);

        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "denied");
        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, () -> "signed-url");

        assertThat(recordedEntries()).extracting(AuditEntry::getOutcome)
                .containsExactly(AuditOutcome.REFUSED, AuditOutcome.SUCCESS);
    }

    @Test
    void run_twoSensitiveReadsOfOneTargetInOneRequest_recordsBoth() {
        inARequest();
        runsTheWork();
        succeeds("secret");
        when(recorder.recordAudited(any(), any())).thenReturn(true);
        when(writer.targetIdOf(AuditTargetType.DEVICE, "machine-1")).thenReturn("machine-1");

        runner.run(AuditAction.FLEET_HOST_SECRET_VIEW, "machine-1", () -> "secret");
        runner.run(AuditAction.REMOTE_CLIPBOARD_VIEW, "machine-1", () -> "secret");

        assertThat(recordedEntries()).extracting(AuditEntry::getAction)
                .containsExactly(AuditAction.FLEET_HOST_SECRET_VIEW, AuditAction.REMOTE_CLIPBOARD_VIEW);
    }

    @Test
    void run_sensitiveReadsOfTwoTargetsInOneRequest_recordsBoth() {
        inARequest();
        runsTheWork();
        succeeds("signed-url");
        when(recorder.recordAudited(any(), any())).thenReturn(true);
        when(writer.targetIdOf(AuditTargetType.TICKET, "ticket-1")).thenReturn("ticket-1");
        when(writer.targetIdOf(AuditTargetType.TICKET, "ticket-2")).thenReturn("ticket-2");

        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, "ticket-1", () -> "signed-url");
        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, "ticket-2", () -> "signed-url");

        assertThat(recordedEntries()).extracting(AuditEntry::getTargetId).containsExactly("ticket-1", "ticket-2");
    }

    @Test
    void run_auditOff_runsTheWorkWithoutRecording() {
        AuditedMethodRunner off = new AuditedMethodRunner(targets, targetRepository, outcomeResolver, recorder, writer, documentConverter, false);

        String result = off.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        assertThat(result).isEqualTo("archived");
        verifyNoInteractions(targets, targetRepository, outcomeResolver, recorder, writer, documentConverter);
    }

    @Test
    void run_storedRecordAndCallBothNameTheTarget_keepsTheStoredValues() {
        ticketIdKnown();
        runsTheWork();
        succeeds("added");
        stored(ticket("Printer offline", "org-1", "device-1"));

        runner.run(namedByTheCall(taggedTicket()), () -> "added");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly("Printer offline", "org-1", "device-1");
    }

    @Test
    void run_storedRecordNamesNoCustomerOrDevice_takesThemFromTheCall() {
        ticketIdKnown();
        runsTheWork();
        succeeds("added");
        stored(ticket("Printer offline", null, null));

        runner.run(namedByTheCall(taggedTicket()), () -> "added");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly("Printer offline", "org-9", "device-9");
    }

    @Test
    void run_targetWithoutLoader_takesNameCustomerAndDeviceFromTheCall() {
        runsTheWork();
        succeeds("deleted");
        when(writer.targetIdOf(AuditTargetType.FLEET_POLICY, "policy-1")).thenReturn("policy-1");
        when(targets.find(AuditTargetType.FLEET_POLICY)).thenReturn(List.of());
        when(targetRepository.load(List.of(), "policy-1")).thenReturn(Optional.empty());

        runner.run(namedByTheCall(AuditCall.of(AuditAction.FLEET_POLICY_DELETE, "policy-1")), () -> "deleted");

        assertThat(recordedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly("Disk encryption", "org-9", "device-9");
    }

    @Test
    void run_updateTurnsAChildActionFieldOn_recordsTheChildEventUnderTheUpdate() {
        runsTheWork();
        succeeds("saved");
        when(recorder.context()).thenReturn(REQUEST_CONTEXT);
        connectionUpdated(connection(false), connection(true).append("name", "Acme Workspace"));

        runner.run(AuditAction.DIRECTORY_CONNECTION_UPDATE, CONNECTION_ID, () -> "saved");

        verify(recorder, times(2)).recordAudited(entryCaptor.capture(), contextCaptor.capture());
        String eventId = declaredContext().parentEventId();
        assertThat(entryCaptor.getAllValues())
                .extracting(AuditEntry::getId, AuditEntry::getAction, AuditEntry::getTargetId,
                        AuditEntry::getTargetName)
                .containsExactly(
                        tuple(eventId, AuditAction.DIRECTORY_CONNECTION_UPDATE, CONNECTION_ID, "Acme Workspace"),
                        tuple(null, AuditAction.DIRECTORY_WRITES_ENABLE, CONNECTION_ID, "Acme Workspace"));
        assertThat(entryCaptor.getAllValues()).extracting(AuditEntry::getChanges).satisfiesExactly(
                parentChanges -> assertThat(parentChanges).isNotEmpty(),
                childChanges -> assertThat(childChanges).isNull());
        assertThat(contextCaptor.getAllValues())
                .containsExactly(REQUEST_CONTEXT, REQUEST_CONTEXT.withParentEventId(eventId));
    }

    @Test
    void run_updateWithTheChildActionFieldAlreadyOn_recordsOnlyTheUpdate() {
        runsTheWork();
        succeeds("saved");
        connectionUpdated(connection(true), connection(true).append("rules", "engineering"));

        runner.run(AuditAction.DIRECTORY_CONNECTION_UPDATE, CONNECTION_ID, () -> "saved");

        assertThat(recordedEntry().getAction()).isEqualTo(AuditAction.DIRECTORY_CONNECTION_UPDATE);
    }

    @Test
    void run_updateTurnsAChildActionFieldOff_recordsOnlyTheUpdate() {
        runsTheWork();
        succeeds("saved");
        connectionUpdated(connection(true), connection(false));

        runner.run(AuditAction.DIRECTORY_CONNECTION_UPDATE, CONNECTION_ID, () -> "saved");

        assertThat(recordedEntry().getAction()).isEqualTo(AuditAction.DIRECTORY_CONNECTION_UPDATE);
    }

    @Test
    void run_refusedUpdateTurnsAChildActionFieldOn_recordsOnlyTheUpdate() {
        runsTheWork();
        when(outcomeResolver.ofResult("locked"))
                .thenReturn(new ActionOutcome(AuditOutcome.REFUSED, "Connection is locked"));
        connectionUpdated(connection(false), connection(true));

        runner.run(AuditAction.DIRECTORY_CONNECTION_UPDATE, CONNECTION_ID, () -> "locked");

        assertThat(recordedEntry().getAction()).isEqualTo(AuditAction.DIRECTORY_CONNECTION_UPDATE);
    }

    @Test
    void run_updateWhoseReadBeforeFailed_recordsNoChildEvent() {
        runsTheWork();
        succeeds("saved");
        when(writer.targetIdOf(AuditTargetType.DIRECTORY_CONNECTION, CONNECTION_ID)).thenReturn(CONNECTION_ID);
        when(targets.find(AuditTargetType.DIRECTORY_CONNECTION)).thenReturn(CONNECTION_TARGETS);
        Document after = connection(true);
        when(targetRepository.load(CONNECTION_TARGETS, CONNECTION_ID))
                .thenThrow(new DataAccessResourceFailureException("Mongo primary unavailable"))
                .thenReturn(Optional.of(new LoadedTarget(CONNECTION_TARGET, after)));

        runner.run(AuditAction.DIRECTORY_CONNECTION_UPDATE, CONNECTION_ID, () -> "saved");

        assertThat(recordedEntry().getAction()).isEqualTo(AuditAction.DIRECTORY_CONNECTION_UPDATE);
        verify(documentConverter, never()).toDocument(after);
    }

    @Test
    void run_createWithTheChildActionFieldOn_recordsTheChildEventToo() {
        runsTheWork();
        succeeds(CONNECTION_ID);
        Document created = storedConnectionWithWritesOn();
        writesFields(created, created);

        runner.run(connectionIdInResult(AuditAction.DIRECTORY_CONNECTION_CREATE), () -> CONNECTION_ID);

        assertThat(recordedEntries()).extracting(AuditEntry::getAction)
                .containsExactly(AuditAction.DIRECTORY_CONNECTION_CREATE, AuditAction.DIRECTORY_WRITES_ENABLE);
    }

    @Test
    void run_otherActionWithTheIdInTheResult_recordsNoChildEvent() {
        runsTheWork();
        succeeds(CONNECTION_ID);
        Document accepted = storedConnectionWithWritesOn();

        runner.run(connectionIdInResult(AuditAction.DIRECTORY_CONSENT_ACCEPT), () -> CONNECTION_ID);

        assertThat(recordedEntry().getAction()).isEqualTo(AuditAction.DIRECTORY_CONSENT_ACCEPT);
        verify(documentConverter, never()).toDocument(accepted);
    }

    @Test
    void run_actionIsItselfTheChildActionOfTheFieldItTurnsOn_recordsItOnce() {
        runsTheWork();
        succeeds("saved");
        connectionUpdated(connection(false), connection(true));

        runner.run(AuditAction.DIRECTORY_WRITES_ENABLE, CONNECTION_ID, () -> "saved");

        assertThat(recordedEntry().getAction()).isEqualTo(AuditAction.DIRECTORY_WRITES_ENABLE);
    }

    @Test
    void run_updateWithAChildEvent_readsTheDetailsOnceForBothEvents() {
        runsTheWork();
        succeeds("saved");
        connectionUpdated(connection(false), connection(true));
        AuditCall call = AuditCall.of(AuditAction.DIRECTORY_CONNECTION_UPDATE, CONNECTION_ID)
                .withDetailsFromResult(_ -> Map.of("read", ++detailReads));

        runner.run(call, () -> "saved");

        assertThat(recordedEntries()).extracting(AuditEntry::getDetails)
                .containsExactly(Map.of("read", 1), Map.of("read", 1));
    }

    @Test
    void run_anyAction_tracksItsChildrenFromBeforeTheWorkUntilItEnds() {
        runsTheWork();
        succeeds("added");

        runner.run(taggedTicket(), () -> "added");

        String eventId = recordedEntry().getId();
        InOrder order = inOrder(writer, recorder);
        order.verify(writer).trackChildrenOf(eventId);
        order.verify(recorder).runInContext(any(), ArgumentMatchers.<AuditedWork<Object, RuntimeException>>any());
        order.verify(writer).hadChildren(eventId);
    }

    @Test
    void run_workThrows_stopsTrackingItsChildren() {
        runsTheWork();
        ForbiddenException refusal = refusedByTheResolver();
        AuditedWork<Object, RuntimeException> refused = () -> {
            throw refusal;
        };

        assertThatThrownBy(() -> runner.run(taggedTicket(), refused)).isSameAs(refusal);

        String eventId = recordedEntry().getId();
        verify(writer).hadChildren(eventId);
    }

    @Test
    void run_sameSensitiveReadOfAnotherItemOfTheTargetInOneRequest_recordsBoth() {
        inARequest();
        ticketIdKnown();
        runsTheWork();
        succeeds("signed-url");
        when(recorder.recordAudited(any(), any())).thenReturn(true);

        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, Map.of("attachmentId", "a1"), () -> "signed-url");
        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, Map.of("attachmentId", "a2"), () -> "signed-url");

        assertThat(recordedEntries()).extracting(AuditEntry::getDetails)
                .containsExactly(Map.of("attachmentId", "a1"), Map.of("attachmentId", "a2"));
    }

    @Test
    void run_sameSensitiveReadWithDetailsThatOnlyLookTheSame_recordsBoth() {
        inARequest();
        ticketIdKnown();
        runsTheWork();
        succeeds("signed-url");
        when(recorder.recordAudited(any(), any())).thenReturn(true);

        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, Map.of("count", 1), () -> "signed-url");
        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, Map.of("count", "1"), () -> "signed-url");

        verify(recorder, times(2)).recordAudited(any(), any());
    }

    @Test
    void run_sameSensitiveReadWithADetailTheEventDrops_recordsItOnce() {
        inARequest();
        ticketIdKnown();
        runsTheWork();
        succeeds("signed-url");
        noChildrenRecorded();
        when(recorder.recordAudited(any(), any())).thenReturn(true);

        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, Map.of("fields", new String[]{"password"}),
                () -> "signed-url");
        runner.run(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, TICKET_ID, Map.of("fields", new String[]{"password"}),
                () -> "signed-url");

        verify(recorder).recordAudited(any(), any());
    }

    @Test
    void run_changedFieldHoldsAMaskedValueInside_hidesOnlyThatValue() {
        ticketIdKnown();
        runsTheWork();
        succeeds("updated");
        updated(new Document("consents", new Document("CORE", consent("PENDING", "n-1"))),
                new Document("consents", new Document("CORE", consent("GRANTED", "n-2"))
                        .append("AUDIT", List.of(consent("PENDING", "n-3")))));

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "updated");

        assertThat(recordedEntry().getChanges()).containsExactly(Map.entry("consents", new AuditChange(
                new Document("CORE", consent("PENDING", "[hidden]")),
                new Document("CORE", consent("GRANTED", "[hidden]"))
                        .append("AUDIT", List.of(consent("PENDING", "[hidden]"))))));
    }

    @Test
    void run_onlyAMaskedValueInsideAFieldChanged_storesTheFieldAsChanged() {
        ticketIdKnown();
        runsTheWork();
        succeeds("updated");
        updated(new Document("consents", new Document("CORE", consent("PENDING", "n-1"))),
                new Document("consents", new Document("CORE", consent("PENDING", "n-2"))));

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "updated");

        assertThat(recordedEntry().getChanges())
                .containsExactly(Map.entry("consents", new AuditChange("[changed]", "[changed]")));
    }

    @Test
    void run_sameSensitiveReadOfTwoTargetTypesWithOneIdInOneRequest_recordsBoth() {
        inARequest();
        runsTheWork();
        succeeds("output");
        when(recorder.recordAudited(any(), any())).thenReturn(true);
        when(writer.targetIdOf(any(), eq("run-1"))).thenReturn("run-1");

        runner.run(AuditAction.SCRIPT_OUTPUT_VIEW, AuditTargetType.EXECUTION, "run-1", Map.of(), () -> "output");
        runner.run(AuditAction.SCRIPT_OUTPUT_VIEW, AuditTargetType.SCRIPT_SCHEDULE, "run-1", Map.of(), () -> "output");

        assertThat(recordedEntries()).extracting(AuditEntry::getTargetType)
                .containsExactly(AuditTargetType.EXECUTION, AuditTargetType.SCRIPT_SCHEDULE);
    }

    @Test
    void run_saveLostToAnotherWriter_recordsTheFailureWithoutTheOtherWritersChanges() {
        OptimisticLockingFailureException conflict = new OptimisticLockingFailureException("version 3 is stale");

        assertThat(entryOfAFailedUpdate(conflict))
                .extracting(AuditEntry::getTargetName, AuditEntry::getChanges)
                .containsExactly("Printer offline, edited", null);
        verify(documentConverter, never()).toDocument(any());
    }

    @Test
    void run_saveLostToAnotherWriterInsideAnotherFailure_recordsTheFailureWithoutChanges() {
        IllegalStateException failure = new IllegalStateException("Retries used up",
                new OptimisticLockingFailureException("version 3 is stale"));

        assertThat(entryOfAFailedUpdate(failure).getChanges()).isNull();
        verify(documentConverter, never()).toDocument(any());
    }

    @Test
    void run_amountSavedWithAnotherScale_recordsNothing() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        updated(new Document("budget", new Decimal128(new BigDecimal("50"))),
                new Document("budget", new Decimal128(new BigDecimal("50.00"))));
        noChildrenRecorded();

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        verify(recorder, never()).recordAudited(any(), any());
    }

    @Test
    void run_amountInsideANestedValueSavedWithAnotherScale_recordsNothing() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        updated(new Document("plan", new Document("prices", List.of(new Decimal128(new BigDecimal("299"))))),
                new Document("plan", new Document("prices", List.of(new Decimal128(new BigDecimal("299.00"))))));
        noChildrenRecorded();

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        verify(recorder, never()).recordAudited(any(), any());
    }

    @Test
    void run_amountInsideANestedValueChanged_recordsTheWholeValueBeforeAndAfter() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        Document before = new Document("prices", List.of(new Decimal128(new BigDecimal("299"))));
        Document after = new Document("prices", List.of(new Decimal128(new BigDecimal("349"))));
        updated(new Document("plan", before), new Document("plan", after));

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(recordedEntry().getChanges()).containsExactly(Map.entry("plan", new AuditChange(before, after)));
    }

    @Test
    void run_listInsideAValueGotLonger_recordsTheChange() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        updated(new Document("tags", List.of("vip")), new Document("tags", List.of("vip", "urgent")));

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(recordedEntry().getChanges())
                .containsExactly(Map.entry("tags", new AuditChange(List.of("vip"), List.of("vip", "urgent"))));
    }

    @Test
    void run_amountChanged_recordsTheChange() {
        ticketIdKnown();
        runsTheWork();
        succeeds("saved");
        Decimal128 before = new Decimal128(new BigDecimal("50"));
        Decimal128 after = new Decimal128(new BigDecimal("60"));
        updated(new Document("budget", before), new Document("budget", after));

        runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> "saved");

        assertThat(recordedEntry().getChanges()).containsExactly(Map.entry("budget", new AuditChange(before, after)));
    }

    private AuditEntry entryOfAFailedUpdate(RuntimeException failure) {
        ticketIdKnown();
        runsTheWork();
        stored(ticket("Printer offline", "org-1", "device-1"), ticket("Printer offline, edited", "org-1", "device-1"));
        when(outcomeResolver.ofFailure(failure))
                .thenReturn(new ActionOutcome(AuditOutcome.FAILURE, failure.getClass().getSimpleName()));

        assertThatThrownBy(() -> runner.run(AuditAction.TICKET_UPDATE, TICKET_ID, () -> {
            throw failure;
        })).isSameAs(failure);

        return recordedEntry();
    }

    private void noChildrenRecorded() {
        when(writer.hadChildren(any())).thenReturn(false);
    }

    private void ticketIdKnown() {
        when(writer.targetIdOf(AuditTargetType.TICKET, TICKET_ID)).thenReturn(TICKET_ID);
    }

    private void runsTheWork() {
        when(recorder.runInContext(any(), ArgumentMatchers.<AuditedWork<Object, RuntimeException>>any()))
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
        writesFields(before, beforeFields);
        writesFields(after, afterFields);
        when(documentConverter.versionFieldOf(after)).thenReturn("version");
    }

    private void writesFields(Object document, Document fields) {
        when(documentConverter.toDocument(document)).thenReturn(fields);
    }

    private Document storedConnectionWithWritesOn() {
        Document connection = connection(true);
        when(targets.find(AuditTargetType.DIRECTORY_CONNECTION)).thenReturn(CONNECTION_TARGETS);
        when(targetRepository.load(CONNECTION_TARGETS, CONNECTION_ID))
                .thenReturn(Optional.of(new LoadedTarget(CONNECTION_TARGET, connection)));
        return connection;
    }

    private void connectionUpdated(Document before, Document after) {
        when(writer.targetIdOf(AuditTargetType.DIRECTORY_CONNECTION, CONNECTION_ID)).thenReturn(CONNECTION_ID);
        when(targets.find(AuditTargetType.DIRECTORY_CONNECTION)).thenReturn(CONNECTION_TARGETS);
        when(targetRepository.load(CONNECTION_TARGETS, CONNECTION_ID)).thenReturn(
                Optional.of(new LoadedTarget(CONNECTION_TARGET, before)),
                Optional.of(new LoadedTarget(CONNECTION_TARGET, after)));
        writesFields(before, before);
        writesFields(after, after);
    }

    private AuditEntry recordedEntry() {
        verify(recorder).recordAudited(entryCaptor.capture(), any());
        return entryCaptor.getValue();
    }

    private List<AuditEntry> recordedEntries() {
        verify(recorder, times(2)).recordAudited(entryCaptor.capture(), any());
        return entryCaptor.getAllValues();
    }

    private void verifyTheTargetWasReadOnceAfterTheWork(String targetId) {
        verify(targetRepository).load(any(), any());
        InOrder order = inOrder(recorder, targetRepository);
        order.verify(recorder).runInContext(any(), ArgumentMatchers.<AuditedWork<Object, RuntimeException>>any());
        order.verify(targetRepository).load(TICKET_TARGETS, targetId);
    }

    private AuditContext declaredContext() {
        verify(recorder).runInContext(declaredCaptor.capture(), ArgumentMatchers.<AuditedWork<Object, RuntimeException>>any());
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

    private static Document consent(String status, String nonce) {
        return new Document("status", status).append("nonce", nonce);
    }

    private static Document connection(boolean writesEnabled) {
        return new Document("name", "Acme Google").append("writesEnabled", writesEnabled);
    }
}
