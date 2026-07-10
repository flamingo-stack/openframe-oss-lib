package com.openframe.data.integration.service.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.service.notification.NotificationReadStateService;
import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(classes = IntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class NotificationReadStateServiceIT extends BaseMongoIntegrationTest {

    private static final String ALICE = "user-alice";
    private static final String BOB = "user-bob";
    private static final String MACHINE_1 = "machine-1";
    private static final RecipientType U = RecipientType.USER;
    private static final RecipientType M = RecipientType.MACHINE;
    private static final NotificationCategory CAT_TICKETS = NotificationCategory.TICKETS;
    private static final NotificationCategory CAT_MINGO = NotificationCategory.MINGO;

    @Autowired
    private NotificationReadStateService service;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollections() {
        mongoTemplate.dropCollection(Notification.class);
        mongoTemplate.dropCollection(NotificationReadState.class);
    }

    @Test
    @DisplayName("Given an eager-created UNREAD row, when markRead is called, then hasUnread flips from true to false for the recipient")
    void unread_to_read_round_trip() {
        service.createForAudience("notif-1", CAT_TICKETS, "title", U, Set.of(ALICE));
        assertThat(service.hasUnread(ALICE, U)).isTrue();
        assertThat(service.markRead(ALICE, U, "notif-1")).isTrue();
        assertThat(service.hasUnread(ALICE, U)).isFalse();
    }

    @Test
    @DisplayName("Given a blank/null recipientId or null recipientType, when hasUnread is called, then it throws ConstraintViolationException — invalid input is caller's bug, not a silent miss")
    void blank_input_throws() {
        assertThatThrownBy(() -> service.hasUnread(null, U)).isInstanceOf(ConstraintViolationException.class);
        assertThatThrownBy(() -> service.hasUnread("", U)).isInstanceOf(ConstraintViolationException.class);
        assertThatThrownBy(() -> service.hasUnread(ALICE, null)).isInstanceOf(ConstraintViolationException.class);
    }

    @Test
    @DisplayName("Given no read_state row for the caller, when markRead is called, then it returns false — caller is not in audience")
    void mark_read_no_audience() {
        assertThat(service.markRead(ALICE, U, "ghost")).isFalse();
    }

    @Test
    @DisplayName("Given two recipients sharing a notification, when one marks it read, then the other recipient's hasUnread stays true — markRead is per-recipient")
    void audience_isolation_by_id() {
        service.createForAudience("notif-1", CAT_TICKETS, "title", U, Set.of(ALICE, BOB));
        service.markRead(ALICE, U, "notif-1");

        assertThat(service.hasUnread(ALICE, U)).isFalse();
        assertThat(service.hasUnread(BOB, U)).isTrue();
    }

    @Test
    @DisplayName("Given separate USER and MACHINE rows, when hasUnread is queried per recipientType, then each type sees only its own state — recipientType disambiguates")
    void audience_isolation_by_type() {
        service.createForAudience("notif-user", CAT_TICKETS, "title", U, Set.of(ALICE));
        service.createForAudience("notif-machine", CAT_TICKETS, "title", M, Set.of(MACHINE_1));

        assertThat(service.hasUnread(ALICE, U)).isTrue();
        assertThat(service.hasUnread(ALICE, M)).isFalse();
        assertThat(service.hasUnread(MACHINE_1, M)).isTrue();
        assertThat(service.hasUnread(MACHINE_1, U)).isFalse();
    }

    @Test
    @DisplayName("Given multiple UNREAD rows for the recipient, when markAllAsRead is called, then every row flips to READ in one bulk update and hasUnread becomes false")
    void mark_all_as_read() {
        service.createForAudience("n1", CAT_TICKETS, "title", U, Set.of(ALICE));
        service.createForAudience("n2", CAT_TICKETS, "title", U, Set.of(ALICE));

        assertThat(service.markAllAsRead(ALICE, U)).isEqualTo(2L);
        assertThat(service.hasUnread(ALICE, U)).isFalse();
    }

    @Test
    @DisplayName("Given a notification with active rows for several recipients, when dismissForAllRecipients is called, then every recipient's row is soft-deleted (status=DELETED) so it leaves the active list into history for all — used on a shared lifecycle-resolve (e.g. an approval resolved by one admin)")
    void dismiss_for_all_recipients_soft_deletes_every_recipient() {
        service.createForAudience("notif-1", CAT_TICKETS, "title", U, Set.of(ALICE, BOB));
        assertThat(service.hasUnread(ALICE, U)).isTrue();
        assertThat(service.hasUnread(BOB, U)).isTrue();

        assertThat(service.dismissForAllRecipients("notif-1")).isEqualTo(2L);

        List<NotificationReadState> rows = mongoTemplate.findAll(NotificationReadState.class);
        assertThat(rows).hasSize(2);
        assertThat(rows).allSatisfy(r -> assertThat(r.getStatus()).isEqualTo(ReadStatus.DELETED));
        assertThat(service.hasUnread(ALICE, U)).isFalse();
        assertThat(service.hasUnread(BOB, U)).isFalse();
    }

    @Test
    @DisplayName("Given rows flipped to READ via markAllAsRead, when they are read back as entities, then readAt is a real Instant — regression: $$NOW must be a server/param timestamp, never the literal string '$$NOW' (which fails Instant conversion on read)")
    void read_at_is_a_real_instant_not_literal_now() {
        Instant before = Instant.now();
        service.createForAudience("notif-1", CAT_TICKETS, "title", U, Set.of(ALICE, BOB));
        service.markAllAsRead(ALICE, U);
        service.markAllAsRead(BOB, U);

        // If readAt were persisted as the literal string "$$NOW", deserializing NotificationReadState
        // (Instant readAt) below would throw DateTimeParseException.
        List<NotificationReadState> rows = mongoTemplate.findAll(NotificationReadState.class);
        assertThat(rows).hasSize(2);
        assertThat(rows).allSatisfy(r -> {
            assertThat(r.getStatus()).isEqualTo(ReadStatus.READ);
            assertThat(r.getReadAt()).isNotNull().isInstanceOf(Instant.class);
            assertThat(r.getReadAt()).isAfterOrEqualTo(before.minusSeconds(5));
        });
    }

    @Test
    @DisplayName("Given one recipient who already deleted their row and one still active, when dismissForAllRecipients is called, then only the active row moves to DELETED (returns 1) — already-DELETED rows are left untouched")
    void dismiss_for_all_recipients_leaves_already_deleted_untouched() {
        service.createForAudience("notif-1", CAT_TICKETS, "title", U, Set.of(ALICE, BOB));
        service.deleteNotification(BOB, U, "notif-1");

        assertThat(service.dismissForAllRecipients("notif-1")).isEqualTo(1L);

        List<NotificationReadState> rows = mongoTemplate.findAll(NotificationReadState.class);
        assertThat(rows).allSatisfy(r -> assertThat(r.getStatus()).isEqualTo(ReadStatus.DELETED));
        assertThat(service.hasUnread(ALICE, U)).isFalse();
    }

    @Test
    @DisplayName("Given a blank/null notificationId, when dismissForAllRecipients is called, then it throws ConstraintViolationException — invalid input is caller's bug")
    void dismiss_for_all_recipients_blank_throws() {
        assertThatThrownBy(() -> service.dismissForAllRecipients(null)).isInstanceOf(ConstraintViolationException.class);
        assertThatThrownBy(() -> service.dismissForAllRecipients("")).isInstanceOf(ConstraintViolationException.class);
    }

    @Test
    @DisplayName("Given a read_state row for the caller, when deleteNotification is called, then the row is soft-deleted (status=DELETED) — Notification document and other recipients are untouched")
    void delete_notification_soft_deletes() {
        service.createForAudience("n1", CAT_TICKETS, "title", U, Set.of(ALICE));
        assertThat(service.deleteNotification(ALICE, U, "n1")).isTrue();

        NotificationReadState row = mongoTemplate.findAll(NotificationReadState.class).get(0);
        assertThat(row.getStatus()).isEqualTo(ReadStatus.DELETED);
    }

    @Test
    @DisplayName("Given a mix of UNREAD and READ rows for the recipient, when deleteAllRead is called, then only READ rows transition to DELETED — UNREAD rows remain visible and hasUnread stays true")
    void delete_all_read() {
        service.createForAudience("n1", CAT_TICKETS, "title", U, Set.of(ALICE));
        service.createForAudience("n2", CAT_TICKETS, "title", U, Set.of(ALICE));
        service.markRead(ALICE, U, "n1");

        assertThat(service.deleteAllRead(ALICE, U)).isEqualTo(1L);
        assertThat(service.hasUnread(ALICE, U)).isTrue();
    }

    @Test
    @DisplayName("Given UNREAD rows across multiple categories for the recipient, when unreadCountsByCategory is called, then a map of category → count is returned aggregating only that recipient's UNREAD rows")
    void unread_counts_by_category() {
        service.createForAudience("n1", CAT_TICKETS, "title", U, Set.of(ALICE));
        service.createForAudience("n2", CAT_TICKETS, "title", U, Set.of(ALICE));
        service.createForAudience("n3", CAT_MINGO, "title", U, Set.of(ALICE));

        Map<NotificationCategory, Long> counts = service.unreadCountsByCategory(ALICE, U);
        assertThat(counts).containsEntry(CAT_TICKETS, 2L).containsEntry(CAT_MINGO, 1L);
    }

}
