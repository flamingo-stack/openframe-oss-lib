package com.openframe.audit;

import com.openframe.audit.targets.AuditTarget;
import com.openframe.audit.targets.AuditTargetRepository;
import com.openframe.audit.targets.AuditTargets;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.user.Invitation;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;

import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
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
    private static final AuditTarget<Invitation> INVITATION_TARGET =
            AuditTarget.of(AuditTargetType.INVITATION, Invitation.class, Invitation::getEmail).withSecretId(true);

    @Mock private AuditTargetRepository targetRepository;
    @Mock private AuditRecorder recorder;
    @Captor private ArgumentCaptor<AuditEntry> entryCaptor;

    private AuditCapture capture;

    @BeforeEach
    void setUp() {
        AuditTargets targets = new AuditTargets(List.of(() -> List.of(TICKET_TARGET, INVITATION_TARGET)));
        capture = new AuditCapture(targets, targetRepository, new AuditOutcomeResolver(), recorder);
    }

    @Test
    void recordsTheChangedFieldsOfAnUpdate() {
        Ticket before = ticket("Printer offline");
        Ticket after = ticket("Printer offline");
        after.setDescription("new text");
        storedOnPrimary(before, after);
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
        after.setDescription("same stored fields");
        storedOnPrimary(before, after);
        when(targetRepository.storedFieldsOf(before)).thenReturn(fields("OPEN", "text", "10:00"));
        when(targetRepository.storedFieldsOf(after)).thenReturn(fields("OPEN", "text", "10:05"));

        capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> null);

        AuditEntry entry = recordedEntry();
        assertThat(entry.getChanges()).isNull();
        assertThat(entry.getDetails()).containsEntry(AuditCapture.NO_CHANGE_DETAIL, true);
    }

    @Test
    void takesTheIdOfACreatedRecordFromTheResult() {
        Ticket created = ticket("New ticket");
        when(targetRepository.findOnPrimary(TICKET_TARGET, "ticket-2")).thenReturn(Optional.of(created));
        AuditCall call = new AuditCall(AuditAction.TICKET_CREATE, AuditTargetType.TICKET, () -> null,
                result -> (String) result, _ -> Map.of(), true);

        String result = capture.capture(call, () -> "ticket-2");

        assertThat(result).isEqualTo("ticket-2");
        AuditEntry entry = recordedEntry();
        assertThat(entry.getTargetId()).isEqualTo("ticket-2");
        assertThat(entry.getTargetName()).isEqualTo("New ticket");
        assertThat(entry.getChanges()).isNull();
        verify(targetRepository, times(1)).findOnPrimary(any(), any());
    }

    @Test
    void namesARecordGoneAfterTheCallFromTheReadBeforeIt() {
        Ticket before = ticket("Old ticket");
        when(targetRepository.findOnPrimary(TICKET_TARGET, TICKET_ID))
                .thenReturn(Optional.of(before))
                .thenReturn(Optional.empty());

        capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> { });

        AuditEntry entry = recordedEntry();
        assertThat(entry.getTargetName()).isEqualTo("Old ticket");
        assertThat(entry.getOrganizationId()).isEqualTo("org-1");
        assertThat(entry.getChanges()).isNull();
    }

    @Test
    void recordsARefusalAndRethrowsIt() {
        Ticket before = ticket("Printer offline");
        when(targetRepository.findOnPrimary(TICKET_TARGET, TICKET_ID)).thenReturn(Optional.of(before));
        ForbiddenException refusal = new ForbiddenException("Only admins can archive tickets");

        assertThatThrownBy(() -> capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> {
            throw refusal;
        })).isSameAs(refusal);

        AuditEntry entry = recordedEntry();
        assertThat(entry.getOutcome()).isEqualTo(AuditOutcome.REFUSED);
        assertThat(entry.getReason()).isEqualTo("Only admins can archive tickets");
        assertThat(entry.getTargetName()).isEqualTo("Printer offline");
        verify(targetRepository, times(1)).findOnPrimary(any(), any());
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
        verifyNoInteractions(targetRepository);
    }

    @Test
    void keepsTheActionWorkingWhenTheTargetReadFails() {
        when(targetRepository.findOnPrimary(TICKET_TARGET, TICKET_ID))
                .thenThrow(new DataAccessResourceFailureException("mongo down"));

        String result = capture.run(AuditAction.TICKET_ARCHIVE, TICKET_ID, () -> "archived");

        assertThat(result).isEqualTo("archived");
        AuditEntry entry = recordedEntry();
        assertThat(entry.getTargetId()).isEqualTo(TICKET_ID);
        assertThat(entry.getTargetName()).isNull();
    }

    @Test
    void keepsTheActionWorkingWhenRecordingFails() {
        doThrow(new IllegalStateException("broken recorder")).when(recorder).record(any(), any());

        String result = capture.run(AuditAction.FLEET_POLICY_DELETE, "policy-1", () -> "deleted");

        assertThat(result).isEqualTo("deleted");
    }

    @Test
    void storesTheHashOfASecretId() {
        Invitation invitation = new Invitation();
        invitation.setEmail("new@acme.com");
        when(targetRepository.findOnPrimary(eq(INVITATION_TARGET), eq("join-secret")))
                .thenReturn(Optional.of(invitation));
        when(targetRepository.storedFieldsOf(invitation)).thenReturn(new Document("email", "new@acme.com"));

        capture.run(AuditAction.INVITATION_REVOKE, "join-secret", () -> { });

        AuditEntry entry = recordedEntry();
        assertThat(entry.getTargetId()).hasSize(64).doesNotContain("join-secret");
        assertThat(entry.getTargetName()).isEqualTo("new@acme.com");
    }

    @Test
    void namesTheFactInsteadOfComparingWhenTheChangeLivesElsewhere() {
        Ticket ticket = ticket("Printer offline");
        when(targetRepository.findOnPrimary(TICKET_TARGET, TICKET_ID)).thenReturn(Optional.of(ticket));
        AuditCall call = new AuditCall(AuditAction.TICKET_TAG_ADD, AuditTargetType.TICKET, () -> TICKET_ID,
                _ -> null, _ -> Map.of("tagId", "tag-1"), false);

        capture.capture(call, () -> null);

        AuditEntry entry = recordedEntry();
        assertThat(entry.getChanges()).isNull();
        assertThat(entry.getDetails()).containsExactly(Map.entry("tagId", "tag-1"));
        assertThat(entry.getTargetName()).isEqualTo("Printer offline");
        verify(targetRepository, times(1)).findOnPrimary(any(), any());
    }

    @Test
    void doesNotCompareASensitiveRead() {
        Ticket ticket = ticket("Printer offline");
        when(targetRepository.findOnPrimary(TICKET_TARGET, TICKET_ID)).thenReturn(Optional.of(ticket));
        AuditCall call = new AuditCall(AuditAction.TICKET_ATTACHMENT_DOWNLOAD, AuditTargetType.TICKET,
                () -> TICKET_ID, _ -> null, _ -> Map.of(), true);

        capture.capture(call, () -> "signed-url");

        AuditEntry entry = recordedEntry();
        assertThat(entry.getChanges()).isNull();
        assertThat(entry.getDetails()).isNull();
        assertThat(entry.getTargetName()).isEqualTo("Printer offline");
        verify(targetRepository, times(1)).findOnPrimary(any(), any());
    }

    @Test
    void runsAnActionWithSeveralTargetKindsAndNoTargetTypeUnaudited() {
        assertThat(capture.run(AuditAction.LINK_CREATE, "link-1", () -> "done")).isEqualTo("done");
        verifyNoInteractions(targetRepository, recorder);
    }

    private void storedOnPrimary(Ticket before, Ticket after) {
        when(targetRepository.findOnPrimary(TICKET_TARGET, TICKET_ID))
                .thenReturn(Optional.of(before))
                .thenReturn(Optional.of(after));
    }

    private AuditEntry recordedEntry() {
        verify(recorder).record(entryCaptor.capture(), any());
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
