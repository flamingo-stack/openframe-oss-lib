package com.openframe.data.integration.service.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.service.notification.NotificationReadStateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = IntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class NotificationReadStateServiceIT extends BaseMongoIntegrationTest {

    private static final String ALICE = "user-alice";
    private static final String BOB = "user-bob";
    private static final String MACHINE_1 = "machine-1";
    private static final RecipientType U = RecipientType.USER;
    private static final RecipientType M = RecipientType.MACHINE;

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
        service.createForAudience("notif-1", "T", U, Set.of(ALICE));
        assertThat(service.hasUnread(ALICE, U)).isTrue();
        assertThat(service.markRead(ALICE, U, "notif-1")).isTrue();
        assertThat(service.hasUnread(ALICE, U)).isFalse();
    }

    @Test
    @DisplayName("Given a blank/null recipientId or null recipientType, when hasUnread is called, then it short-circuits to false without hitting the database")
    void blank_short_circuits() {
        service.createForAudience("notif-1", "T", U, Set.of(ALICE));
        assertThat(service.hasUnread(null, U)).isFalse();
        assertThat(service.hasUnread("", U)).isFalse();
        assertThat(service.hasUnread(ALICE, null)).isFalse();
    }

    @Test
    @DisplayName("Given no read_state row for the caller, when markRead is called, then it returns false — caller is not in audience")
    void mark_read_no_audience() {
        assertThat(service.markRead(ALICE, U, "ghost")).isFalse();
    }

    @Test
    @DisplayName("Given two recipients sharing a notification, when one marks it read, then the other recipient's hasUnread stays true — markRead is per-recipient")
    void audience_isolation_by_id() {
        service.createForAudience("notif-1", "T", U, Set.of(ALICE, BOB));
        service.markRead(ALICE, U, "notif-1");

        assertThat(service.hasUnread(ALICE, U)).isFalse();
        assertThat(service.hasUnread(BOB, U)).isTrue();
    }

    @Test
    @DisplayName("Given separate USER and MACHINE rows, when hasUnread is queried per recipientType, then each type sees only its own state — recipientType disambiguates")
    void audience_isolation_by_type() {
        service.createForAudience("notif-user", "T", U, Set.of(ALICE));
        service.createForAudience("notif-machine", "T", M, Set.of(MACHINE_1));

        assertThat(service.hasUnread(ALICE, U)).isTrue();
        assertThat(service.hasUnread(ALICE, M)).isFalse();
        assertThat(service.hasUnread(MACHINE_1, M)).isTrue();
        assertThat(service.hasUnread(MACHINE_1, U)).isFalse();
    }

    @Test
    @DisplayName("Given multiple UNREAD rows for the recipient, when markAllAsRead is called, then every row flips to READ in one bulk update and hasUnread becomes false")
    void mark_all_as_read() {
        service.createForAudience("n1", "T", U, Set.of(ALICE));
        service.createForAudience("n2", "T", U, Set.of(ALICE));

        assertThat(service.markAllAsRead(ALICE, U)).isEqualTo(2L);
        assertThat(service.hasUnread(ALICE, U)).isFalse();
    }

    @Test
    @DisplayName("Given a read_state row for the caller, when deleteNotification is called, then the row is soft-deleted (status=DELETED) — Notification document and other recipients are untouched")
    void delete_notification_soft_deletes() {
        service.createForAudience("n1", "T", U, Set.of(ALICE));
        assertThat(service.deleteNotification(ALICE, U, "n1")).isTrue();

        NotificationReadState row = mongoTemplate.findAll(NotificationReadState.class).get(0);
        assertThat(row.getStatus()).isEqualTo(ReadStatus.DELETED);
    }

    @Test
    @DisplayName("Given a mix of UNREAD and READ rows for the recipient, when deleteAllRead is called, then only READ rows transition to DELETED — UNREAD rows remain visible and hasUnread stays true")
    void delete_all_read() {
        service.createForAudience("n1", "T", U, Set.of(ALICE));
        service.createForAudience("n2", "T", U, Set.of(ALICE));
        service.markRead(ALICE, U, "n1");

        assertThat(service.deleteAllRead(ALICE, U)).isEqualTo(1L);
        assertThat(service.hasUnread(ALICE, U)).isTrue();
    }

    @Test
    @DisplayName("Given UNREAD rows across multiple contextTypes for the recipient, when unreadCountsByType is called, then a map of contextType → count is returned aggregating only that recipient's UNREAD rows")
    void unread_counts_by_type() {
        service.createForAudience("n1", "TYPE_A", U, Set.of(ALICE));
        service.createForAudience("n2", "TYPE_A", U, Set.of(ALICE));
        service.createForAudience("n3", "TYPE_B", U, Set.of(ALICE));

        Map<String, Long> counts = service.unreadCountsByType(ALICE, U);
        assertThat(counts).containsEntry("TYPE_A", 2L).containsEntry("TYPE_B", 1L);
    }

}
