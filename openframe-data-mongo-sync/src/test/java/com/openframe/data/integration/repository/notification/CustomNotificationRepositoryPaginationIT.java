package com.openframe.data.integration.repository.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.integration.support.NotificationFixtures;
import com.openframe.data.repository.notification.NotificationRepository;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(classes = IntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CustomNotificationRepositoryPaginationIT extends BaseMongoIntegrationTest {

    private static final String ALICE = "user-alice";
    private static final String BOB = "user-bob";

    @Autowired
    private NotificationRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollection() {
        mongoTemplate.dropCollection(Notification.class);
    }

    @Test
    @DisplayName("Given several notifications and no cursor, when listing for the user, then they come back newest-first by _id")
    void given_no_cursor_when_listing_for_user_then_returns_descending_by_id() {
        List<Notification> seeded = seedSequential(ALICE, 5);

        List<Notification> page = repository.findPageForUser(ALICE, null, false, 10);

        assertThat(page).hasSize(5);
        assertThat(page.get(0).getId()).isEqualTo(seeded.get(4).getId());
        assertThat(page.get(4).getId()).isEqualTo(seeded.get(0).getId());
    }

    @Test
    @DisplayName("Given a forward cursor, when listing for the user, then only rows older than the cursor are returned")
    void given_forward_cursor_when_listing_for_user_then_returns_older_rows() {
        List<Notification> seeded = seedSequential(ALICE, 5);
        String cursor = seeded.get(2).getId();

        List<Notification> page = repository.findPageForUser(ALICE, cursor, false, 10);

        assertThat(page).extracting(Notification::getId)
                .containsExactly(seeded.get(1).getId(), seeded.get(0).getId());
    }

    @Test
    @DisplayName("Given a backward cursor, when listing for the user, then rows newer than the cursor are returned in ascending order")
    void given_backward_cursor_when_listing_for_user_then_returns_newer_rows_ascending() {
        List<Notification> seeded = seedSequential(ALICE, 5);
        String cursor = seeded.get(2).getId();

        List<Notification> page = repository.findPageForUser(ALICE, cursor, true, 10);

        assertThat(page).extracting(Notification::getId)
                .containsExactly(seeded.get(3).getId(), seeded.get(4).getId());
    }

    @Test
    @DisplayName("Given a malformed cursor, when listing for the user, then IllegalArgumentException is raised so callers see a real error instead of silently falling back to the first page")
    void given_invalid_cursor_when_listing_for_user_then_throws_illegal_argument() {
        seedSequential(ALICE, 3);

        // Surfacing as IllegalArgumentException lets DGS turn this into a
        // GraphQL error rather than silently dropping back to the first page —
        // a malformed cursor is a client bug, not a "give them anything".
        assertThatThrownBy(() ->
                repository.findPageForUser(ALICE, "not-an-objectid", false, 10))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not-an-objectid");
    }

    @Test
    @DisplayName("Given notifications addressed to several users, when listing for one user, then only that user's rows are returned")
    void given_notifications_for_multiple_users_when_listing_for_one_then_only_that_users_rows_are_returned() {
        seedSequential(ALICE, 3);
        seedSequential(BOB, 3);

        List<Notification> alicePage = repository.findPageForUser(ALICE, null, false, 10);
        assertThat(alicePage).allSatisfy(n -> assertThat(n.getRecipientUserId()).isEqualTo(ALICE));
        assertThat(alicePage).hasSize(3);
    }

    @Test
    @DisplayName("Given more rows than the requested limit, when listing for the user, then only `limit` rows come back")
    void given_more_rows_than_limit_when_listing_for_user_then_only_limit_rows_returned() {
        seedSequential(ALICE, 10);

        List<Notification> page = repository.findPageForUser(ALICE, null, false, 4);

        assertThat(page).hasSize(4);
    }

    @Test
    @DisplayName("Given no notifications match the recipient, when listing for the user, then an empty page is returned")
    void given_no_matches_when_listing_for_user_then_empty_page_returned() {
        List<Notification> page = repository.findPageForUser("ghost", null, false, 10);
        assertThat(page).isEmpty();
    }

    @Test
    @DisplayName("Given direct notifications and a tenant-wide broadcast, when listing for the user, then the broadcast appears alongside the user's own rows")
    void given_user_rows_and_broadcast_when_listing_for_user_then_broadcast_is_included() {
        Notification own1 = repository.save(NotificationFixtures.basic(ALICE, "own-1", "{}"));
        sleepBriefly();
        Notification broadcast = repository.save(NotificationFixtures.broadcast("ann-1", "{}"));
        sleepBriefly();
        Notification own2 = repository.save(NotificationFixtures.basic(ALICE, "own-2", "{}"));

        List<Notification> page = repository.findPageForUser(ALICE, null, false, 10);

        assertThat(page).extracting(Notification::getId)
                .containsExactly(own2.getId(), broadcast.getId(), own1.getId());
    }

    @Test
    @DisplayName("Given another user's direct notifications, when listing for the caller, then those direct rows do not leak into the caller's page")
    void given_other_users_direct_rows_when_listing_for_caller_then_no_leakage() {
        repository.save(NotificationFixtures.basic(ALICE, "own", "{}"));
        repository.save(NotificationFixtures.basic(BOB, "bobs", "{}"));
        Notification broadcast = repository.save(NotificationFixtures.broadcast("ann", "{}"));

        List<Notification> alicePage = repository.findPageForUser(ALICE, null, false, 10);

        // Alice sees her own + broadcast, never Bob's direct notification.
        assertThat(alicePage).extracting(Notification::getRecipientUserId)
                .containsOnly(ALICE, null);
        assertThat(alicePage).extracting(Notification::getId)
                .contains(broadcast.getId());
    }

    @Test
    @DisplayName("Given a machine-targeted row, an unrelated machine's row and a broadcast, when listing for the machine, then it sees its own row and the broadcast but not the other machine's row")
    void given_machine_rows_and_broadcast_when_listing_for_machine_then_only_own_and_broadcast_visible() {
        String machineId = "machine-42";
        Notification ownDirect = repository.save(NotificationFixtures.forMachine(machineId, "own", "{}"));
        sleepBriefly();
        Notification broadcast = repository.save(NotificationFixtures.broadcast("ann", "{}"));
        sleepBriefly();
        Notification someoneElsesDirect = repository.save(NotificationFixtures.forMachine("other-machine", "x", "{}"));

        List<Notification> page = repository.findPageForMachine(machineId, null, false, 10);

        assertThat(page).extracting(Notification::getId)
                .containsExactly(broadcast.getId(), ownDirect.getId());
        assertThat(page).extracting(Notification::getId)
                .doesNotContain(someoneElsesDirect.getId());
    }

    private List<Notification> seedSequential(String recipient, int count) {
        List<Notification> saved = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            saved.add(repository.save(NotificationFixtures.basic(recipient, "type-" + i, "{\"i\":" + i + "}")));
            sleepBriefly();
        }
        return saved;
    }

    private void sleepBriefly() {
        try {
            Thread.sleep(2);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
