package com.openframe.data.integration.service.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.integration.support.NotificationFixtures;
import com.openframe.data.service.notification.NotificationReadStateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
class NotificationReadStateServiceIT extends BaseMongoIntegrationTest {

    private static final String ALICE = "user-alice";
    private static final String BOB = "user-bob";

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
    @DisplayName("Given an unread notification, when the caller marks it read, then hasUnread flips from true to false")
    void given_unread_notification_when_marked_read_then_has_unread_flips_to_false() {
        Notification persisted = mongoTemplate.save(NotificationFixtures.basic(ALICE));

        assertThat(service.hasUnread(ALICE)).isTrue();

        boolean inserted = service.markRead(ALICE, persisted.getId());

        assertThat(inserted).isTrue();
        assertThat(service.hasUnread(ALICE)).isFalse();
    }

    @Test
    @DisplayName("Given a blank or null userId, when hasUnread is called, then it short-circuits to false without hitting the database")
    void given_blank_or_null_user_id_when_has_unread_called_then_short_circuits_to_false() {
        mongoTemplate.save(NotificationFixtures.basic(ALICE));

        assertThat(service.hasUnread(null)).isFalse();
        assertThat(service.hasUnread("")).isFalse();
        assertThat(service.hasUnread("   ")).isFalse();
    }

    @Test
    @DisplayName("Given a mix of read and unread notifications, when findReadIds is called, then only the ids the user has read come back")
    void given_mix_of_read_and_unread_when_find_read_ids_then_returns_only_read_subset() {
        Notification first = mongoTemplate.save(NotificationFixtures.basic(ALICE));
        Notification second = mongoTemplate.save(NotificationFixtures.basic(ALICE));
        Notification third = mongoTemplate.save(NotificationFixtures.basic(ALICE));

        service.markRead(ALICE, first.getId());
        service.markRead(ALICE, third.getId());

        Set<String> readIds = service.findReadIds(ALICE,
                List.of(first.getId(), second.getId(), third.getId()));

        assertThat(readIds).containsExactlyInAnyOrder(first.getId(), third.getId());
    }

    @Test
    @DisplayName("Given an empty inbox, when hasUnread is called, then it returns false")
    void given_empty_inbox_when_has_unread_called_then_returns_false() {
        assertThat(service.hasUnread(ALICE)).isFalse();
    }

    @Test
    @DisplayName("Given every notification has been read, when hasUnread is called, then it returns false")
    void given_all_notifications_read_when_has_unread_called_then_returns_false() {
        Notification first = mongoTemplate.save(NotificationFixtures.basic(ALICE));
        Notification second = mongoTemplate.save(NotificationFixtures.basic(ALICE));

        service.markRead(ALICE, first.getId());
        service.markRead(ALICE, second.getId());

        assertThat(service.hasUnread(ALICE)).isFalse();
    }

    @Test
    @DisplayName("Given some notifications read and some unread, when hasUnread is called, then it returns true")
    void given_some_read_and_some_unread_when_has_unread_called_then_returns_true() {
        Notification first = mongoTemplate.save(NotificationFixtures.basic(ALICE));
        mongoTemplate.save(NotificationFixtures.basic(ALICE));

        service.markRead(ALICE, first.getId());

        assertThat(service.hasUnread(ALICE)).isTrue();
    }

    @Test
    @DisplayName("Given Bob has an unread row and Alice marks an unrelated id, when hasUnread runs, then Alice's mark-read does not affect Bob's bell")
    void given_one_user_marks_unrelated_id_when_has_unread_called_then_other_user_state_is_isolated() {
        Notification shared = mongoTemplate.save(NotificationFixtures.basic(BOB));
        service.markRead(ALICE, shared.getId());

        assertThat(service.hasUnread(BOB)).isTrue();
        assertThat(service.hasUnread(ALICE)).isFalse();
    }

    @Test
    @DisplayName("Given only an unread tenant-wide broadcast and no direct rows, when hasUnread is called, then it returns true")
    void given_only_unread_broadcast_when_has_unread_called_then_returns_true() {
        mongoTemplate.save(NotificationFixtures.broadcast("tenant-announcement", "{}"));

        assertThat(service.hasUnread(ALICE)).isTrue();
    }

    @Test
    @DisplayName("Given a broadcast that the caller has marked read, when hasUnread is called, then it returns false for the caller but stays true for users who never read it")
    void given_broadcast_read_by_caller_when_has_unread_called_then_caller_sees_false_others_see_true() {
        Notification broadcast = mongoTemplate.save(NotificationFixtures.broadcast("tenant-announcement", "{}"));

        service.markRead(ALICE, broadcast.getId());

        assertThat(service.hasUnread(ALICE)).isFalse();
        assertThat(service.hasUnread(BOB)).isTrue();
    }

    @Test
    @DisplayName("Given only another user's unread notifications, when hasUnread is called for the caller, then it returns false")
    void given_only_other_users_notifications_when_has_unread_called_for_caller_then_returns_false() {
        mongoTemplate.save(NotificationFixtures.basic(BOB));

        assertThat(service.hasUnread(ALICE)).isFalse();
    }
}
