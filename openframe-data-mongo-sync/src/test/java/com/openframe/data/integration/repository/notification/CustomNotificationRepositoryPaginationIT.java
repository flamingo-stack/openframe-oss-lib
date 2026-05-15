package com.openframe.data.integration.repository.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.integration.support.NotificationFixtures;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.repository.notification.NotificationWithStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = IntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CustomNotificationRepositoryPaginationIT extends BaseMongoIntegrationTest {

    private static final String ALICE = "user-alice";
    private static final String BOB = "user-bob";
    private static final RecipientType U = RecipientType.USER;
    private static final RecipientType M = RecipientType.MACHINE;

    @Autowired
    private NotificationRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollection() {
        mongoTemplate.dropCollection(Notification.class);
        mongoTemplate.dropCollection(NotificationReadState.class);
    }

    @Test
    @DisplayName("Given several UNREAD read_state rows for the recipient and no cursor, when listing, then they come back newest-first by notificationId and each item carries its ReadStatus")
    void given_no_cursor_returns_descending() {
        List<Notification> seeded = seedSequentialForRecipient(ALICE, U, 5);

        List<NotificationWithStatus> page = repository.findPageForRecipient(ALICE, U, null, null, null, false, 10);

        assertThat(page).hasSize(5);
        assertThat(page.get(0).notification().getId()).isEqualTo(seeded.get(4).getId());
        assertThat(page.get(4).notification().getId()).isEqualTo(seeded.get(0).getId());
        assertThat(page).allSatisfy(item -> assertThat(item.status()).isEqualTo(ReadStatus.UNREAD));
    }

    @Test
    @DisplayName("Given a forward cursor, when listing for the recipient, then only rows with notificationId older than the cursor are returned")
    void given_forward_cursor_returns_older_rows() {
        List<Notification> seeded = seedSequentialForRecipient(ALICE, U, 5);
        String cursor = seeded.get(2).getId();

        List<NotificationWithStatus> page = repository.findPageForRecipient(ALICE, U, null, null, cursor, false, 10);

        assertThat(page).extracting(it -> it.notification().getId())
                .containsExactly(seeded.get(1).getId(), seeded.get(0).getId());
    }

    @Test
    @DisplayName("Given a backward cursor, when listing for the recipient, then rows with notificationId newer than the cursor are returned (caller reverses for display)")
    void given_backward_cursor_returns_newer_rows() {
        List<Notification> seeded = seedSequentialForRecipient(ALICE, U, 5);
        String cursor = seeded.get(2).getId();

        List<NotificationWithStatus> page = repository.findPageForRecipient(ALICE, U, null, null, cursor, true, 10);

        assertThat(page).extracting(it -> it.notification().getId())
                .containsExactlyInAnyOrder(seeded.get(3).getId(), seeded.get(4).getId());
    }

    @Test
    @DisplayName("Given read_state rows for two different recipientIds, when listing for one of them, then only that recipient's rows are returned")
    void audience_isolation_by_id() {
        seedSequentialForRecipient(ALICE, U, 3);
        seedSequentialForRecipient(BOB, U, 3);

        List<NotificationWithStatus> alicePage = repository.findPageForRecipient(ALICE, U, null, null, null, false, 10);
        assertThat(alicePage).hasSize(3);
    }

    @Test
    @DisplayName("Given the same recipientId stored under USER and MACHINE recipientType, when listing per type, then each type sees only its own rows — types are isolated even on identical id strings")
    void audience_isolation_by_type() {
        String sharedId = "shared-id";
        seedSequentialForRecipient(sharedId, U, 2);
        seedSequentialForRecipient(sharedId, M, 3);

        assertThat(repository.findPageForRecipient(sharedId, U, null, null, null, false, 10)).hasSize(2);
        assertThat(repository.findPageForRecipient(sharedId, M, null, null, null, false, 10)).hasSize(3);
    }

    @Test
    @DisplayName("Given more rows than the requested limit, when listing for the recipient, then only `limit` rows come back")
    void limit_honored() {
        seedSequentialForRecipient(ALICE, U, 10);
        assertThat(repository.findPageForRecipient(ALICE, U, null, null, null, false, 4)).hasSize(4);
    }

    @Test
    @DisplayName("Given no read_state rows for the recipient, when listing, then an empty page is returned")
    void empty_when_no_rows() {
        assertThat(repository.findPageForRecipient("ghost", U, null, null, null, false, 10)).isEmpty();
    }

    @Test
    @DisplayName("Given a read_state row with status=DELETED, when listing with no read filter, then that row is excluded from the page")
    void deleted_excluded_by_default() {
        Notification a = seedNotification("a");
        Notification b = seedNotification("b");
        seedReadState(ALICE, U, a.getId(), ReadStatus.UNREAD);
        seedReadState(ALICE, U, b.getId(), ReadStatus.DELETED);

        List<NotificationWithStatus> page = repository.findPageForRecipient(ALICE, U, null, null, null, false, 10);
        assertThat(page).extracting(it -> it.notification().getId()).containsExactly(a.getId());
    }

    @Test
    @DisplayName("Given mixed UNREAD and READ rows, when listing with readFilter=true, then only the READ row is returned and its NotificationWithStatus carries READ")
    void read_filter_true() {
        Notification a = seedNotification("a");
        Notification b = seedNotification("b");
        seedReadState(ALICE, U, a.getId(), ReadStatus.UNREAD);
        seedReadState(ALICE, U, b.getId(), ReadStatus.READ);

        List<NotificationWithStatus> page = repository.findPageForRecipient(ALICE, U, true, null, null, false, 10);
        assertThat(page).hasSize(1);
        assertThat(page.get(0).notification().getId()).isEqualTo(b.getId());
        assertThat(page.get(0).status()).isEqualTo(ReadStatus.READ);
    }

    @Test
    @DisplayName("Given mixed UNREAD and READ rows, when listing with readFilter=false, then only the UNREAD row is returned and its NotificationWithStatus carries UNREAD")
    void read_filter_false() {
        Notification a = seedNotification("a");
        Notification b = seedNotification("b");
        seedReadState(ALICE, U, a.getId(), ReadStatus.UNREAD);
        seedReadState(ALICE, U, b.getId(), ReadStatus.READ);

        List<NotificationWithStatus> page = repository.findPageForRecipient(ALICE, U, false, null, null, false, 10);
        assertThat(page).hasSize(1);
        assertThat(page.get(0).notification().getId()).isEqualTo(a.getId());
        assertThat(page.get(0).status()).isEqualTo(ReadStatus.UNREAD);
    }

    @Test
    @DisplayName("Given two notifications with different titles and a non-blank search term, when listing for the recipient, then only the notification whose title matches the search is returned (case-insensitive)")
    void search_filters_by_title() {
        Notification welcome = repository.save(NotificationFixtures.basic("welcome", "{}"));
        sleepBriefly();
        Notification alert = repository.save(NotificationFixtures.basic("ALERT", "{}"));
        seedReadState(ALICE, U, welcome.getId(), ReadStatus.UNREAD);
        seedReadState(ALICE, U, alert.getId(), ReadStatus.UNREAD);

        List<NotificationWithStatus> page = repository.findPageForRecipient(ALICE, U, null, "alert", null, false, 10);
        assertThat(page).extracting(it -> it.notification().getId()).containsExactly(alert.getId());
    }

    private Notification seedNotification(String type) {
        Notification n = repository.save(NotificationFixtures.basic(type, "{}"));
        sleepBriefly();
        return n;
    }

    private List<Notification> seedSequentialForRecipient(String recipientId, RecipientType type, int count) {
        List<Notification> saved = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            Notification n = repository.save(NotificationFixtures.basic("type-" + i, "{}"));
            seedReadState(recipientId, type, n.getId(), ReadStatus.UNREAD);
            sleepBriefly();
            saved.add(n);
        }
        return saved;
    }

    private void seedReadState(String recipientId, RecipientType type, String notificationId, ReadStatus status) {
        NotificationReadState rs = NotificationReadState.builder()
                .recipientId(recipientId)
                .recipientType(type)
                .notificationId(notificationId)
                .status(status)
                .contextType("test")
                .build();
        mongoTemplate.save(rs);
    }

    private void sleepBriefly() {
        try {
            Thread.sleep(2);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
