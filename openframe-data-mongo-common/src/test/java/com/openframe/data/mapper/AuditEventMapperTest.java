package com.openframe.data.mapper;

import com.github.f4b6a3.ulid.Ulid;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.model.audit.AuditRequestInfo;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static com.openframe.data.document.audit.AuditAction.LINK_CREATE;
import static com.openframe.data.document.audit.AuditAction.TICKET_ARCHIVE;
import static com.openframe.data.document.audit.AuditActorType.MINGO;
import static com.openframe.data.document.audit.AuditActorType.USER;
import static com.openframe.data.document.audit.AuditOutcome.SUCCESS;
import static com.openframe.data.document.audit.AuditTargetType.KB_ARTICLE;
import static com.openframe.data.document.audit.AuditTargetType.TICKET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuditEventMapperTest {

    private static final AuditRequestInfo NO_REQUEST = new AuditRequestInfo(null, null, null, null);
    private static final Instant OCCURRED_AT = Instant.parse("2026-10-28T14:12:00Z");

    private final AuditEventMapper mapper = new AuditEventMapperImpl();

    @Test
    void toEvent_entryWithoutId_mintsUlid() {
        AuditEvent event = eventOf(ticketArchive().build());

        assertThat(Ulid.isValid(event.getId())).isTrue();
    }

    @Test
    void toEvent_entryWithId_keepsEntryId() {
        AuditEvent event = eventOf(ticketArchive().id("01JC4X2Q7V9M3T8R5N6P1K0W2Z").build());

        assertThat(event.getId()).isEqualTo("01JC4X2Q7V9M3T8R5N6P1K0W2Z");
    }

    @Test
    void toEvent_entryNamesParent_keepsEntryParent() {
        AuditEntry entry = ticketArchive().parentEventId("event-named").build();

        AuditEvent event = mapper.toEvent(entry, AuditActor.system(), NO_REQUEST, "tenant-1", "event-running",
                OCCURRED_AT);

        assertThat(event.getParentEventId()).isEqualTo("event-named");
    }

    @Test
    void toEvent_entryNamesNoParent_takesRunningEventAsParent() {
        AuditEvent event = mapper.toEvent(ticketArchive().build(), AuditActor.system(), NO_REQUEST, "tenant-1",
                "event-running", OCCURRED_AT);

        assertThat(event.getParentEventId()).isEqualTo("event-running");
    }

    @Test
    void toEvent_entryNamesNoTargetType_takesActionTargetType() {
        AuditEvent event = eventOf(ticketArchive().build());

        assertThat(event.getTargetType()).isEqualTo(TICKET);
    }

    @Test
    void toEvent_entryNamesTargetType_takesItOverActionTargetType() {
        AuditEvent event = eventOf(ticketArchive().targetType(KB_ARTICLE).build());

        assertThat(event.getTargetType()).isEqualTo(KB_ARTICLE);
    }

    @Test
    void toEvent_neitherEntryNorActionNamesTargetType_throws() {
        AuditEntry entry = AuditEntry.builder().action(LINK_CREATE).outcome(SUCCESS).build();

        assertThatThrownBy(() -> eventOf(entry)).isInstanceOf(NullPointerException.class);
    }

    @Test
    void toEvent_listedAction_storesItsListName() {
        AuditEvent event = eventOf(ticketArchive().build());

        assertThat(event.getAction()).isEqualTo("ticket.archive");
    }

    @Test
    void toEvent_anyEntry_stampsCurrentSchemaVersion() {
        AuditEvent event = eventOf(ticketArchive().build());

        assertThat(event.getSchemaVersion()).isEqualTo(AuditEvent.SCHEMA_VERSION);
    }

    @Test
    void toEvent_recordingTime_storesItAsOccurredAt() {
        AuditEvent event = eventOf(ticketArchive().build());

        assertThat(event.getOccurredAt()).isEqualTo(Instant.parse("2026-10-28T14:12:00Z"));
    }

    @Test
    void toEvent_entryNamesNoTenant_storesResolvedTenant() {
        AuditEvent event = mapper.toEvent(ticketArchive().build(), AuditActor.system(), NO_REQUEST,
                "tenant-resolved", null, OCCURRED_AT);

        assertThat(event.getTenantId()).isEqualTo("tenant-resolved");
    }

    @Test
    void toEvent_userActor_storesWhoActed() {
        AuditActor anna = new AuditActor(USER, "user-anna", "Anna Kowalski", "anna@example.com",
                List.of("ADMIN", "TECHNICIAN"), "tenant-1", null, null);

        AuditEvent event = mapper.toEvent(ticketArchive().build(), anna, NO_REQUEST, "tenant-1", null, OCCURRED_AT);

        assertThat(event)
                .extracting(AuditEvent::getActorType, AuditEvent::getActorId, AuditEvent::getActorEmail,
                        AuditEvent::getActorRoles)
                .containsExactly(USER, "user-anna", "anna@example.com", List.of("ADMIN", "TECHNICIAN"));
    }

    @Test
    void toEvent_aiActorWithApprover_storesSenderAndApprover() {
        AuditActor approver = new AuditActor(USER, "user-approver", null, "owner@example.com", List.of("OWNER"),
                "tenant-1", null, null);
        AuditActor mingo = new AuditActor(MINGO, null, "Mingo", null, List.of(), null, "user-sender", approver);

        AuditEvent event = mapper.toEvent(ticketArchive().build(), mingo, NO_REQUEST, "tenant-1", null, OCCURRED_AT);

        assertThat(event)
                .extracting(AuditEvent::getOnBehalfOfId, AuditEvent::getApproverId)
                .containsExactly("user-sender", "user-approver");
    }

    @Test
    void toEvent_requestSource_storesRequestFields() {
        AuditRequestInfo requestInfo = new AuditRequestInfo("203.0.113.24", "Chrome", "request-1", "session-1");

        AuditEvent event = mapper.toEvent(ticketArchive().build(), AuditActor.system(), requestInfo, "tenant-1", null,
                OCCURRED_AT);

        assertThat(event)
                .extracting(AuditEvent::getSourceIp, AuditEvent::getUserAgent, AuditEvent::getCorrelationId,
                        AuditEvent::getSessionId)
                .containsExactly("203.0.113.24", "Chrome", "request-1", "session-1");
    }

    private AuditEvent eventOf(AuditEntry entry) {
        return mapper.toEvent(entry, AuditActor.system(), NO_REQUEST, "tenant-1", null, OCCURRED_AT);
    }

    private static AuditEntry.AuditEntryBuilder ticketArchive() {
        return AuditEntry.builder().action(TICKET_ARCHIVE).outcome(SUCCESS);
    }
}
