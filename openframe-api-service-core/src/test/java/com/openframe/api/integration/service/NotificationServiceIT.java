package com.openframe.api.integration.service;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.integration.BaseMongoIntegrationTest;
import com.openframe.api.integration.support.NotificationFixtures;
import com.openframe.api.integration.support.ServiceIntegrationTestApplication;
import com.openframe.api.service.NotificationService;
import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.data.document.notification.RecipientScope;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.service.notification.NotificationReadStateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
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
import static org.assertj.core.api.Assertions.tuple;

@SpringBootTest(
        classes = ServiceIntegrationTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE
)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class NotificationServiceIT extends BaseMongoIntegrationTest {

    private static final String ALICE = "user-alice";
    private static final String BOB = "user-bob";

    @Autowired
    private NotificationService service;

    @Autowired
    private NotificationRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private NotificationReadStateService readStateService;

    @BeforeEach
    void resetCollection() {
        mongoTemplate.dropCollection(Notification.class);
        mongoTemplate.dropCollection(NotificationReadState.class);
    }

    @Nested
    @DisplayName("create")
    class Create {

        @Test
        @DisplayName("Given the NATS publisher bean is absent, when creating a notification, then the row is still persisted (fallback scheduler will publish it later)")
        void given_publisher_absent_when_creating_then_row_is_persisted() {
            Notification created = service.create(NotificationFixtures.basic(ALICE));

            assertThat(created.getId()).isNotNull();
            assertThat(repository.findById(created.getId())).isPresent();
        }

        @Test
        @DisplayName("Given the NATS publisher bean is absent, when creating a notification, then publishState defaults to unpublished/0 so the fallback scheduler picks it up")
        void given_publisher_absent_when_creating_then_publish_state_defaults_to_unpublished() {
            Notification created = service.create(NotificationFixtures.basic(ALICE));

            Notification reread = repository.findById(created.getId()).orElseThrow();
            assertThat(reread.getPublishState()).isNotNull();
            assertThat(reread.getPublishState().isPublished()).isFalse();
            assertThat(reread.getPublishState().getAttempts()).isZero();
        }

        @Test
        @DisplayName("Given a fixture-built notification with no severity override, when creating, then severity defaults to INFO and round-trips through persistence")
        void given_fixture_without_severity_when_creating_then_severity_defaults_to_info() {
            Notification created = service.create(NotificationFixtures.basic(ALICE));

            Notification reread = repository.findById(created.getId()).orElseThrow();
            assertThat(reread.getSeverity()).isEqualTo(NotificationSeverity.INFO);
            assertThat(reread.getTitle()).isEqualTo("Welcome aboard");
        }

        @Test
        @DisplayName("Given an explicit non-default severity, when creating, then the severity round-trips through persistence")
        void given_explicit_severity_when_creating_then_severity_round_trips() {
            Notification withDanger = Notification.builder()
                    .recipientUserId(ALICE)
                    .severity(NotificationSeverity.DANGER)
                    .title("Datastore is down")
                    .context(GenericContext.builder().type("incident").payload("{}").build())
                    .build();

            Notification created = service.create(withDanger);

            Notification reread = repository.findById(created.getId()).orElseThrow();
            assertThat(reread.getSeverity()).isEqualTo(NotificationSeverity.DANGER);
            assertThat(reread.getTitle()).isEqualTo("Datastore is down");
        }

        @Test
        @DisplayName("Given a notification with a blank title, when creating, then validation rejects it before any write")
        void given_blank_title_when_creating_then_validation_rejects() {
            Notification noTitle = Notification.builder()
                    .recipientUserId(ALICE)
                    .title("   ")
                    .context(GenericContext.builder().type("welcome").payload("{}").build())
                    .build();

            assertThatThrownBy(() -> service.create(noTitle))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("title");
            assertThat(repository.count()).isZero();
        }

        @Test
        @DisplayName("Given a notification with severity explicitly nulled, when creating, then validation rejects it")
        void given_null_severity_when_creating_then_validation_rejects() {
            Notification withNullSeverity = Notification.builder()
                    .recipientUserId(ALICE)
                    .severity(null)
                    .title("Hi")
                    .context(GenericContext.builder().type("welcome").payload("{}").build())
                    .build();

            assertThatThrownBy(() -> service.create(withNullSeverity))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("severity");
            assertThat(repository.count()).isZero();
        }

        @Test
        @DisplayName("Given a notification without context, when creating, then validation rejects it")
        void given_null_context_when_creating_then_validation_rejects() {
            Notification noContext = Notification.builder()
                    .recipientUserId(ALICE)
                    .title("Hi")
                    .build();

            assertThatThrownBy(() -> service.create(noContext))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("context");
            assertThat(repository.count()).isZero();
        }

        @Test
        @DisplayName("Given a context with a blank type discriminator, when creating, then validation rejects it")
        void given_blank_context_type_when_creating_then_validation_rejects() {
            Notification blankType = Notification.builder()
                    .recipientUserId(ALICE)
                    .title("Hi")
                    .context(GenericContext.builder().type("   ").build())
                    .build();

            assertThatThrownBy(() -> service.create(blankType))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("type");
            assertThat(repository.count()).isZero();
        }
    }

    @Nested
    @DisplayName("hasUnread")
    class HasUnread {

        @Test
        @DisplayName("Given an unread notification for one user, when hasUnread is called, then only that user sees true and others see false — service layer delegates correctly")
        void given_unread_notification_for_one_user_when_has_unread_called_then_only_that_user_sees_true() {
            assertThat(service.hasUnread(ALICE)).isFalse();

            repository.save(NotificationFixtures.basic(ALICE));

            assertThat(service.hasUnread(ALICE)).isTrue();
            assertThat(service.hasUnread(BOB)).isFalse();
        }
    }

    @Nested
    @DisplayName("listForRecipient")
    class ListForRecipient {

        @Test
        @DisplayName("Given fewer rows than the requested limit, when listing, then all rows come back and pageInfo reports no further pages")
        void given_fewer_rows_than_limit_when_listing_then_all_rows_returned_and_no_further_pages() {
            seedSequential(ALICE, 3);

            GenericQueryResult<Notification> result = service.listForRecipient(
                    ALICE, CursorPaginationCriteria.builder().limit(10).build());

            assertThat(result.getItems()).hasSize(3);
            assertThat(result.getPageInfo().isHasNextPage()).isFalse();
            assertThat(result.getPageInfo().isHasPreviousPage()).isFalse();
        }

        @Test
        @DisplayName("Given more rows than the limit, when listing forward, then pageInfo.hasNextPage is true")
        void given_more_rows_than_limit_when_listing_forward_then_has_next_page_is_true() {
            seedSequential(ALICE, 25);

            GenericQueryResult<Notification> result = service.listForRecipient(
                    ALICE, CursorPaginationCriteria.builder().limit(10).build());

            assertThat(result.getItems()).hasSize(10);
            assertThat(result.getPageInfo().isHasNextPage()).isTrue();
        }

        @Test
        @DisplayName("Given the endCursor of the first page, when fetching the next page using it, then the second page contains the next slice of rows")
        void given_end_cursor_of_first_page_when_fetching_next_page_then_returns_next_slice() {
            List<Notification> seeded = seedSequential(ALICE, 25);

            GenericQueryResult<Notification> first = service.listForRecipient(
                    ALICE, CursorPaginationCriteria.builder().limit(10).build());
            String rawCursor = CursorCodec.decode(first.getPageInfo().getEndCursor());

            GenericQueryResult<Notification> second = service.listForRecipient(
                    ALICE, CursorPaginationCriteria.builder().limit(10).cursor(rawCursor).backward(false).build());

            assertThat(second.getItems()).hasSize(10);
            assertThat(second.getItems().get(0).getId()).isEqualTo(seeded.get(14).getId());
        }

        @Test
        @DisplayName("Given a limit above the configured maximum, when listing, then the criteria normalises to the maximum and the page is honoured")
        void given_limit_above_max_when_listing_then_limit_is_normalised() {
            seedSequential(ALICE, 5);

            GenericQueryResult<Notification> result = service.listForRecipient(
                    ALICE, CursorPaginationCriteria.builder().limit(999).build());

            assertThat(result.getItems()).hasSize(5);
        }

        @Test
        @DisplayName("Given a null limit, when listing, then the default page size is applied")
        void given_null_limit_when_listing_then_default_page_size_applied() {
            seedSequential(ALICE, 25);

            GenericQueryResult<Notification> result = service.listForRecipient(
                    ALICE, CursorPaginationCriteria.builder().limit(null).build());

            assertThat(result.getItems()).hasSize(CursorPaginationCriteria.DEFAULT_PAGE_SIZE);
        }

        @Test
        @DisplayName("Given a backward cursor, when listing, then rows newer than the cursor come back in descending order")
        void given_backward_cursor_when_listing_then_returns_newer_rows_in_descending_order() {
            List<Notification> seeded = seedSequential(ALICE, 5);
            String beforeCursor = seeded.get(0).getId();

            GenericQueryResult<Notification> result = service.listForRecipient(
                    ALICE, CursorPaginationCriteria.builder().limit(10).cursor(beforeCursor).backward(true).build());

            assertThat(result.getItems()).extracting(Notification::getId)
                    .containsExactly(
                            seeded.get(4).getId(),
                            seeded.get(3).getId(),
                            seeded.get(2).getId(),
                            seeded.get(1).getId());
        }

        @Test
        @DisplayName("Given notifications addressed to multiple users, when listing for one recipient, then only that recipient's rows come back")
        void given_notifications_for_multiple_recipients_when_listing_for_one_then_only_their_rows_returned() {
            seedSequential(ALICE, 3);
            seedSequential(BOB, 3);

            GenericQueryResult<Notification> result = service.listForRecipient(
                    ALICE, CursorPaginationCriteria.builder().limit(10).build());

            assertThat(result.getItems())
                    .allSatisfy(n -> assertThat(n.getRecipientUserId()).isEqualTo(ALICE));
            assertThat(result.getItems()).hasSize(3);
        }

        @Test
        @DisplayName("Given a recipient with no notifications, when listing, then items are empty and pageInfo cursors are null")
        void given_no_notifications_for_recipient_when_listing_then_items_empty_and_cursors_null() {
            GenericQueryResult<Notification> result = service.listForRecipient(
                    "ghost", CursorPaginationCriteria.builder().limit(10).build());

            assertThat(result.getItems()).isEmpty();
            assertThat(result.getPageInfo().getStartCursor()).isNull();
            assertThat(result.getPageInfo().getEndCursor()).isNull();
        }

        @Test
        @DisplayName("Given some notifications already marked read, when listing, then the read flag on each row reflects the per-user read-state")
        void given_some_notifications_marked_read_when_listing_then_read_flag_reflects_state() {
            List<Notification> seeded = seedSequential(ALICE, 3);
            readStateService.markRead(ALICE, seeded.get(0).getId());
            readStateService.markRead(ALICE, seeded.get(2).getId());

            GenericQueryResult<Notification> result = service.listForRecipient(
                    ALICE, CursorPaginationCriteria.builder().limit(10).build());

            assertThat(result.getItems())
                    .extracting(Notification::getId, Notification::isRead)
                    .containsExactlyInAnyOrder(
                            tuple(seeded.get(0).getId(), true),
                            tuple(seeded.get(1).getId(), false),
                            tuple(seeded.get(2).getId(), true));
        }

        @Test
        @DisplayName("Given Bob marks one of Alice's notifications read for himself, when Alice lists her inbox, then her rows still show read=false")
        void given_other_user_marks_for_themselves_when_listing_for_caller_then_no_read_state_leakage() {
            List<Notification> seeded = seedSequential(ALICE, 2);
            // Bob marks one of Alice's notifications as read for HIM — must not bleed.
            readStateService.markRead(BOB, seeded.get(0).getId());

            GenericQueryResult<Notification> result = service.listForRecipient(
                    ALICE, CursorPaginationCriteria.builder().limit(10).build());

            assertThat(result.getItems())
                    .allSatisfy(n -> assertThat(n.isRead()).isFalse());
        }
    }

    @Nested
    @DisplayName("listForMachine")
    class ListForMachine {

        private static final String MACHINE_ID = "machine-007";

        @Test
        @DisplayName("Given direct machine rows and a tenant-wide broadcast, when listing for the machine, then both come back")
        void given_machine_rows_and_broadcast_when_listing_for_machine_then_both_returned() {
            seedMachineSequential(MACHINE_ID, 3);
            Notification broadcast = repository.save(Notification.builder()
                    .recipientScope(RecipientScope.ALL)
                    .title("Tenant ann")
                    .context(GenericContext.builder().type("ann").payload("{}").build())
                    .build());

            GenericQueryResult<Notification> result = service.listForMachine(
                    MACHINE_ID, CursorPaginationCriteria.builder().limit(10).build());

            assertThat(result.getItems()).extracting(Notification::getId)
                    .contains(broadcast.getId())
                    .hasSize(4);
        }

        @Test
        @DisplayName("Given another machine's notifications, when listing for the caller machine, then those rows do not leak")
        void given_other_machines_rows_when_listing_for_caller_then_no_leakage() {
            seedMachineSequential(MACHINE_ID, 2);
            seedMachineSequential("other-machine", 3);

            GenericQueryResult<Notification> result = service.listForMachine(
                    MACHINE_ID, CursorPaginationCriteria.builder().limit(10).build());

            assertThat(result.getItems()).hasSize(2);
            assertThat(result.getItems())
                    .allSatisfy(n -> assertThat(n.getRecipientMachineId()).isEqualTo(MACHINE_ID));
        }

        @Test
        @DisplayName("Given more rows than the limit, when listing for the machine, then pageInfo.hasNextPage is true")
        void given_more_rows_than_limit_when_listing_for_machine_then_has_next_page() {
            seedMachineSequential(MACHINE_ID, 15);

            GenericQueryResult<Notification> result = service.listForMachine(
                    MACHINE_ID, CursorPaginationCriteria.builder().limit(10).build());

            assertThat(result.getItems()).hasSize(10);
            assertThat(result.getPageInfo().isHasNextPage()).isTrue();
        }
    }

    @Nested
    @DisplayName("markRead")
    class MarkRead {

        @Test
        @DisplayName("Given an unread notification, when markRead is called, then it persists a row — second call returns false because the unique row already exists")
        void given_unread_notification_when_mark_read_then_persists_row_and_is_idempotent() {
            Notification saved = repository.save(NotificationFixtures.basic(ALICE));

            assertThat(service.markRead(ALICE, saved.getId())).isTrue();
            // Idempotency proves the row is persisted: a second call returns
            // false because the unique (userId, notificationId) row already exists.
            assertThat(service.markRead(ALICE, saved.getId())).isFalse();
        }

        @Test
        @DisplayName("Given the same notification, when markRead is called twice, then the first returns true and the second returns false")
        void given_same_notification_when_mark_read_called_twice_then_second_returns_false() {
            Notification saved = repository.save(NotificationFixtures.basic(ALICE));

            assertThat(service.markRead(ALICE, saved.getId())).isTrue();
            assertThat(service.markRead(ALICE, saved.getId())).isFalse();
        }

        @Test
        @DisplayName("Given Alice marks a notification read, when Bob marks the same notification read, then Bob's first call still returns true — read state is per-user")
        void given_alice_marks_read_when_bob_marks_same_then_bob_first_call_returns_true() {
            Notification saved = repository.save(NotificationFixtures.basic(ALICE));

            service.markRead(ALICE, saved.getId());

            // Bob marking the same notification still transitions for him —
            // proves Alice's read row didn't bleed.
            assertThat(service.markRead(BOB, saved.getId())).isTrue();
        }
    }

    private List<Notification> seedSequential(String recipient, int count) {
        List<Notification> saved = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            saved.add(repository.save(NotificationFixtures.basic(recipient, "type-" + i)));
            try {
                Thread.sleep(2);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        return saved;
    }

    private List<Notification> seedMachineSequential(String machineId, int count) {
        List<Notification> saved = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            saved.add(repository.save(Notification.builder()
                    .recipientScope(RecipientScope.MACHINE)
                    .recipientMachineId(machineId)
                    .title("Event " + i)
                    .context(GenericContext.builder().type("type-" + i).payload("{}").build())
                    .build()));
            try {
                Thread.sleep(2);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        return saved;
    }
}
