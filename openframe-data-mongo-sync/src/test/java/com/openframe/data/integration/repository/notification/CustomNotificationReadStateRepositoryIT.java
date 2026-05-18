package com.openframe.data.integration.repository.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.repository.notification.NotificationReadStateRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = IntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CustomNotificationReadStateRepositoryIT extends BaseMongoIntegrationTest {

    private static final String ALICE = "user-alice";
    private static final String BOB = "user-bob";
    private static final String MACHINE_1 = "machine-1";
    private static final RecipientType U = RecipientType.USER;
    private static final RecipientType M = RecipientType.MACHINE;
    private static final NotificationCategory CAT_TICKETS = NotificationCategory.TICKETS;
    private static final NotificationCategory CAT_MINGO = NotificationCategory.MINGO;

    @Autowired
    private NotificationReadStateRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollections() {
        mongoTemplate.dropCollection(Notification.class);
        mongoTemplate.dropCollection(NotificationReadState.class);
        var indexOps = mongoTemplate.indexOps(NotificationReadState.class);
        new MongoPersistentEntityIndexResolver(mongoTemplate.getConverter().getMappingContext())
                .resolveIndexFor(NotificationReadState.class)
                .forEach(indexOps::ensureIndex);
    }

    @Nested
    @DisplayName("createForAudience")
    class CreateForAudience {

        @Test
        @DisplayName("Given multiple recipientIds and a single notificationId, when createForAudience is called, then one UNREAD row is inserted per recipient with denormalized category and the supplied recipientType")
        void bulk_insert_per_recipient() {
            repository.createForAudience("notif-1", CAT_TICKETS, U, Set.of(ALICE, BOB));

            List<NotificationReadState> rows = mongoTemplate.findAll(NotificationReadState.class);
            assertThat(rows).hasSize(2);
            assertThat(rows).allSatisfy(r -> {
                assertThat(r.getNotificationId()).isEqualTo("notif-1");
                assertThat(r.getStatus()).isEqualTo(ReadStatus.UNREAD);
                assertThat(r.getCategory()).isEqualTo(CAT_TICKETS);
                assertThat(r.getRecipientType()).isEqualTo(U);
            });
        }

        @Test
        @DisplayName("Given a machineId and recipientType=MACHINE, when createForAudience is called, then the inserted row stores recipientType=MACHINE so types remain distinguishable from USER")
        void machine_recipient_type() {
            repository.createForAudience("notif-1", CAT_TICKETS, M, Set.of(MACHINE_1));
            List<NotificationReadState> rows = mongoTemplate.findAll(NotificationReadState.class);
            assertThat(rows).hasSize(1);
            assertThat(rows.get(0).getRecipientType()).isEqualTo(M);
        }

        @Test
        @DisplayName("Given an empty recipient set, when createForAudience is called, then no rows are inserted (silent no-op)")
        void empty_set_noop() {
            repository.createForAudience("notif-1", CAT_TICKETS, U, Set.of());
            assertThat(mongoTemplate.findAll(NotificationReadState.class)).isEmpty();
        }

        @Test
        @DisplayName("Given existing rows for ALICE+BOB on notif-1, when createForAudience is called again with ALICE+CAROL, then the duplicate ALICE row is swallowed (MongoBulkWriteException with code 11000) and only CAROL is inserted — broadcast retries stay idempotent")
        void duplicate_recipients_idempotent_inserts_only_new() {
            repository.createForAudience("notif-1", CAT_TICKETS, U, Set.of(ALICE, BOB));

            repository.createForAudience("notif-1", CAT_TICKETS, U, Set.of(ALICE, "user-carol"));

            List<NotificationReadState> rows = mongoTemplate.findAll(NotificationReadState.class);
            assertThat(rows).hasSize(3);
            assertThat(rows).extracting(NotificationReadState::getRecipientId)
                    .containsExactlyInAnyOrder(ALICE, BOB, "user-carol");
        }

        @Test
        @DisplayName("Given identical recipient set inserted twice for the same notificationId, when createForAudience is called the second time, then no exception is thrown and row count stays at the audience size — full overlap is also idempotent")
        void full_overlap_idempotent_noop() {
            repository.createForAudience("notif-1", CAT_TICKETS, U, Set.of(ALICE, BOB));

            repository.createForAudience("notif-1", CAT_TICKETS, U, Set.of(ALICE, BOB));

            assertThat(mongoTemplate.findAll(NotificationReadState.class)).hasSize(2);
        }
    }

    @Nested
    @DisplayName("markRead")
    class MarkRead {

        @Test
        @DisplayName("Given a pre-created UNREAD row for the recipient, when markRead is called, then the row flips to status=READ with readAt populated and the call returns true")
        void unread_row_marked_read() {
            repository.createForAudience("notif-1", CAT_TICKETS, U, Set.of(ALICE));
            assertThat(repository.markRead(ALICE, U, "notif-1")).isTrue();
            NotificationReadState row = mongoTemplate.findAll(NotificationReadState.class).get(0);
            assertThat(row.getStatus()).isEqualTo(ReadStatus.READ);
            assertThat(row.getReadAt()).isNotNull();
        }

        @Test
        @DisplayName("Given a row already in status=READ, when markRead is called again, then it returns false (idempotent — no row state changes)")
        void already_read_idempotent() {
            repository.createForAudience("notif-1", CAT_TICKETS, U, Set.of(ALICE));
            repository.markRead(ALICE, U, "notif-1");
            assertThat(repository.markRead(ALICE, U, "notif-1")).isFalse();
        }

        @Test
        @DisplayName("Given no read_state row exists for the (recipient, notification) pair, when markRead is called, then it returns false and no row is created — caller is not in audience")
        void no_row_returns_false() {
            assertThat(repository.markRead(ALICE, U, "notif-1")).isFalse();
        }

        @Test
        @DisplayName("Given a USER row for some id, when markRead is called with the same id but recipientType=MACHINE, then it returns false — recipientType disambiguates id namespace")
        void recipient_types_isolated() {
            repository.createForAudience("notif-1", CAT_TICKETS, U, Set.of("same-id"));
            assertThat(repository.markRead("same-id", M, "notif-1")).isFalse();
            assertThat(repository.markRead("same-id", U, "notif-1")).isTrue();
        }
    }

    @Nested
    @DisplayName("High-level ops")
    class HighLevelOps {

        @Test
        @DisplayName("Given UNREAD rows for two recipients, when markAllAsRead is called for one of them, then only that recipient's rows flip to READ and the other recipient's hasUnread stays true")
        void mark_all_as_read() {
            repository.createForAudience("n1", CAT_TICKETS, U, Set.of(ALICE));
            repository.createForAudience("n2", CAT_TICKETS, U, Set.of(ALICE));
            repository.createForAudience("n3", CAT_TICKETS, U, Set.of(BOB));

            long modified = repository.markAllAsRead(ALICE, U);

            assertThat(modified).isEqualTo(2L);
            assertThat(repository.hasUnread(ALICE, U)).isFalse();
            assertThat(repository.hasUnread(BOB, U)).isTrue();
        }

        @Test
        @DisplayName("Given a non-deleted row, when softDelete is called, then status flips to DELETED so the row no longer appears in default listings")
        void soft_delete() {
            repository.createForAudience("n1", CAT_TICKETS, U, Set.of(ALICE));
            assertThat(repository.softDelete(ALICE, U, "n1")).isTrue();
            NotificationReadState row = mongoTemplate.findAll(NotificationReadState.class).get(0);
            assertThat(row.getStatus()).isEqualTo(ReadStatus.DELETED);
        }

        @Test
        @DisplayName("Given a mix of UNREAD and READ rows for the recipient, when softDeleteAllRead is called, then only READ rows transition to DELETED — UNREAD rows are left intact")
        void soft_delete_all_read() {
            repository.createForAudience("n1", CAT_TICKETS, U, Set.of(ALICE));
            repository.createForAudience("n2", CAT_TICKETS, U, Set.of(ALICE));
            repository.markRead(ALICE, U, "n1");
            assertThat(repository.softDeleteAllRead(ALICE, U)).isEqualTo(1L);
        }

        @Test
        @DisplayName("Given UNREAD rows across different categories, when unreadCountsByCategory is called, then a map of category → count is returned aggregating only UNREAD rows (READ rows excluded)")
        void unread_counts_by_category() {
            repository.createForAudience("n1", CAT_TICKETS, U, Set.of(ALICE));
            repository.createForAudience("n2", CAT_TICKETS, U, Set.of(ALICE));
            repository.createForAudience("n3", CAT_MINGO, U, Set.of(ALICE));
            repository.markRead(ALICE, U, "n2");

            Map<NotificationCategory, Long> counts = repository.unreadCountsByCategory(ALICE, U);
            assertThat(counts).containsEntry(CAT_TICKETS, 1L).containsEntry(CAT_MINGO, 1L);
        }

    }
}
