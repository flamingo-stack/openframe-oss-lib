package com.openframe.data.integration.repository.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.repository.notification.NotificationReadStateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = IntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CustomNotificationReadStateRepositoryIT extends BaseMongoIntegrationTest {

    private static final String ALICE = "user-alice";
    private static final String BOB = "user-bob";
    private static final RecipientType U = RecipientType.USER;

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

    private static NotificationReadState row(String recipientId, String notificationId) {
        return NotificationReadState.builder()
                .recipientId(recipientId)
                .recipientType(U)
                .notificationId(notificationId)
                .status(ReadStatus.UNREAD)
                .category(NotificationCategory.TICKETS)
                .build();
    }

    @Test
    @DisplayName("Given a list of read_state rows for two recipients on a single notification, when bulkInsertUnordered is called, then both rows are persisted")
    void bulk_insert_persists_all_rows() {
        repository.bulkInsertUnordered(List.of(row(ALICE, "notif-1"), row(BOB, "notif-1")));

        List<NotificationReadState> rows = mongoTemplate.findAll(NotificationReadState.class);
        assertThat(rows).hasSize(2);
        assertThat(rows).extracting(NotificationReadState::getRecipientId)
                .containsExactlyInAnyOrder(ALICE, BOB);
    }

    @Test
    @DisplayName("Given an empty input, when bulkInsertUnordered is called, then it is a silent no-op (no exception, no rows)")
    void empty_input_noop() {
        repository.bulkInsertUnordered(List.of());
        assertThat(mongoTemplate.findAll(NotificationReadState.class)).isEmpty();
    }

    @Test
    @DisplayName("Given existing rows for ALICE+BOB on notif-1, when bulkInsertUnordered is called again with ALICE+CAROL, then duplicate-key errors are swallowed (UNORDERED mode) and only CAROL is added — broadcast retries stay idempotent")
    void duplicate_keys_swallowed_only_new_rows_added() {
        repository.bulkInsertUnordered(List.of(row(ALICE, "notif-1"), row(BOB, "notif-1")));

        repository.bulkInsertUnordered(List.of(row(ALICE, "notif-1"), row("user-carol", "notif-1")));

        List<NotificationReadState> rows = mongoTemplate.findAll(NotificationReadState.class);
        assertThat(rows).hasSize(3);
        assertThat(rows).extracting(NotificationReadState::getRecipientId)
                .containsExactlyInAnyOrder(ALICE, BOB, "user-carol");
    }

    @Test
    @DisplayName("Given identical input inserted twice for the same notification, when bulkInsertUnordered is called the second time, then no exception is thrown and row count stays at the audience size — full overlap is also idempotent")
    void full_overlap_idempotent() {
        repository.bulkInsertUnordered(List.of(row(ALICE, "notif-1"), row(BOB, "notif-1")));

        repository.bulkInsertUnordered(List.of(row(ALICE, "notif-1"), row(BOB, "notif-1")));

        assertThat(mongoTemplate.findAll(NotificationReadState.class)).hasSize(2);
    }
}
