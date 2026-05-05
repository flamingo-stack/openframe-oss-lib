package com.openframe.data.integration.repository.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.repository.notification.NotificationReadStateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = IntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CustomNotificationReadStateRepositoryIT extends BaseMongoIntegrationTest {

    private static final String ALICE = "user-alice";
    private static final String BOB = "user-bob";

    @Autowired
    private NotificationReadStateRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollections() {
        mongoTemplate.dropCollection(Notification.class);
        mongoTemplate.dropCollection(NotificationReadState.class);
    }

    @Nested
    @DisplayName("markRead")
    class MarkRead {

        @Test
        @DisplayName("Given an unread (user, notification) pair, when markRead is called, then a read-state row is inserted with the userId, notificationId and readAt populated")
        void given_unread_pair_when_mark_read_called_then_read_state_row_created() {
            boolean inserted = repository.markRead(ALICE, "notif-1");

            assertThat(inserted).isTrue();
            List<NotificationReadState> rows = mongoTemplate.findAll(NotificationReadState.class);
            assertThat(rows).hasSize(1);
            assertThat(rows.get(0).getUserId()).isEqualTo(ALICE);
            assertThat(rows.get(0).getNotificationId()).isEqualTo("notif-1");
            assertThat(rows.get(0).getReadAt()).isNotNull();
        }

        @Test
        @DisplayName("Given the same (user, notification) pair, when markRead is called twice, then the second call is idempotent — returns false and creates no extra row")
        void given_same_pair_when_mark_read_called_twice_then_second_call_is_idempotent() {
            boolean firstCall = repository.markRead(ALICE, "notif-1");
            boolean secondCall = repository.markRead(ALICE, "notif-1");

            assertThat(firstCall).isTrue();
            assertThat(secondCall).isFalse();
            assertThat(mongoTemplate.findAll(NotificationReadState.class)).hasSize(1);
        }

        @Test
        @DisplayName("Given two different users marking the same notification, when markRead is called for each, then each gets their own read-state row")
        void given_two_users_when_each_marks_same_notification_read_then_each_has_own_row() {
            repository.markRead(ALICE, "notif-1");
            repository.markRead(BOB, "notif-1");

            List<NotificationReadState> rows = mongoTemplate.findAll(NotificationReadState.class);
            assertThat(rows).hasSize(2);
            assertThat(rows).extracting(NotificationReadState::getUserId)
                    .containsExactlyInAnyOrder(ALICE, BOB);
        }
    }

    @Nested
    @DisplayName("findReadIds")
    class FindReadIds {

        @Test
        @DisplayName("Given a mix of read entries for different users and ids, when findReadIds is called for one user, then only that user's matching ids come back")
        void given_mixed_read_entries_when_find_read_ids_called_then_returns_only_matching_user_and_ids() {
            repository.markRead(ALICE, "notif-1");
            repository.markRead(ALICE, "notif-2");
            repository.markRead(BOB, "notif-1");

            Set<String> aliceRead = repository.findReadIds(ALICE,
                    List.of("notif-1", "notif-2", "notif-3"));

            assertThat(aliceRead).containsExactlyInAnyOrder("notif-1", "notif-2");
        }

        @Test
        @DisplayName("Given an empty id collection, when findReadIds is called, then it returns an empty set")
        void given_empty_id_collection_when_find_read_ids_called_then_returns_empty_set() {
            repository.markRead(ALICE, "notif-1");

            assertThat(repository.findReadIds(ALICE, List.of())).isEmpty();
        }

        @Test
        @DisplayName("Given a null id collection, when findReadIds is called, then it returns an empty set")
        void given_null_id_collection_when_find_read_ids_called_then_returns_empty_set() {
            repository.markRead(ALICE, "notif-1");

            assertThat(repository.findReadIds(ALICE, null)).isEmpty();
        }
    }

}
