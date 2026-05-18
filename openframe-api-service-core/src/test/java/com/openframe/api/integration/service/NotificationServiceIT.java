package com.openframe.api.integration.service;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.notification.NotificationFilter;
import com.openframe.api.dto.notification.NotificationView;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.integration.BaseMongoIntegrationTest;
import com.openframe.api.integration.support.NotificationFixtures;
import com.openframe.api.integration.support.ServiceIntegrationTestApplication;
import com.openframe.api.service.NotificationService;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.service.notification.NotificationReadStateService;
import org.bson.types.ObjectId;
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
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Scope: NotificationService.list — pagination + read-flag merge.
 * markRead / markAllAsRead / delete / hasUnread / counts — covered in NotificationReadStateServiceIT.
 */
@SpringBootTest(classes = ServiceIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class NotificationServiceIT extends BaseMongoIntegrationTest {

    private static final String ALICE = "user-alice";
    private static final String BOB = "user-bob";
    private static final String MACHINE_1 = "machine-1";
    private static final RecipientType U = RecipientType.USER;
    private static final RecipientType M = RecipientType.MACHINE;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private NotificationReadStateService readStateService;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void reset() {
        mongoTemplate.dropCollection(Notification.class);
        mongoTemplate.dropCollection(NotificationReadState.class);
    }

    private static CursorPaginationCriteria page10() {
        return CursorPaginationCriteria.builder().limit(10).build();
    }

    @Test
    @DisplayName("Given a notification with a READ read_state for the user, when list is called, then the NotificationView is returned with read=true (status derived from the read_state row, not from filter)")
    void list_user_with_read_flag() {
        Notification n = mongoTemplate.save(NotificationFixtures.basic("welcome"));
        readStateService.createForAudience(n.getId(), NotificationCategory.TICKETS, U, Set.of(ALICE));
        readStateService.markRead(ALICE, U, n.getId());

        GenericQueryResult<NotificationView> result = notificationService.list(ALICE, U, NotificationFilter.EMPTY, page10());

        assertThat(result.getItems()).hasSize(1);
        assertThat(result.getItems().get(0).read()).isTrue();
    }

    @Test
    @DisplayName("Given a read_state row with recipientType=MACHINE for a machineId, when list is called for that machineId+MACHINE, then the machine sees its own notification in the page")
    void list_machine_recipient() {
        Notification n = mongoTemplate.save(NotificationFixtures.basic("ticket-update"));
        readStateService.createForAudience(n.getId(), NotificationCategory.TICKETS, M, Set.of(MACHINE_1));

        GenericQueryResult<NotificationView> result = notificationService.list(MACHINE_1, M, NotificationFilter.EMPTY, page10());

        assertThat(result.getItems()).hasSize(1);
    }

    @Test
    @DisplayName("Given a read_state row addressed to another user, when list is called for the caller, then the page is empty — read_state defines audience visibility")
    void audience_isolation_by_id() {
        Notification n = mongoTemplate.save(NotificationFixtures.basic());
        readStateService.createForAudience(n.getId(), NotificationCategory.TICKETS, U, Set.of(BOB));

        assertThat(notificationService.list(ALICE, U, NotificationFilter.EMPTY, page10()).getItems()).isEmpty();
    }

    @Test
    @DisplayName("Given a single read_state row with recipientId='same-id' and recipientType=USER, when list is called with the same id but recipientType=MACHINE, then the page is empty — recipientType disambiguates")
    void audience_isolation_by_type() {
        Notification n = mongoTemplate.save(NotificationFixtures.basic());
        readStateService.createForAudience(n.getId(), NotificationCategory.TICKETS, U, Set.of("same-id"));

        assertThat(notificationService.list("same-id", U, NotificationFilter.EMPTY, page10()).getItems()).hasSize(1);
        assertThat(notificationService.list("same-id", M, NotificationFilter.EMPTY, page10()).getItems()).isEmpty();
    }

    @Test
    @DisplayName("Given two notifications — one READ and one UNREAD — for the same recipient, when list is called with NotificationFilter(read=true) and then NotificationFilter(read=false), then each call returns exactly the matching row")
    void read_filter_narrows_page() {
        Notification n1 = mongoTemplate.save(NotificationFixtures.basic("a"));
        Notification n2 = mongoTemplate.save(NotificationFixtures.basic("b"));
        readStateService.createForAudience(n1.getId(), NotificationCategory.TICKETS, U, Set.of(ALICE));
        readStateService.createForAudience(n2.getId(), NotificationCategory.TICKETS, U, Set.of(ALICE));
        readStateService.markRead(ALICE, U, n1.getId());

        var readPage = notificationService.list(ALICE, U, new NotificationFilter(true, null), page10());
        assertThat(readPage.getItems()).extracting(NotificationView::id).containsExactly(n1.getId());

        var unreadPage = notificationService.list(ALICE, U, new NotificationFilter(false, null), page10());
        assertThat(unreadPage.getItems()).extracting(NotificationView::id).containsExactly(n2.getId());
    }

    @Test
    @DisplayName("Given a 1-character search term, when list is called, then the search is normalized to no-search (term is too short to be meaningful) and the full page is returned — guards against single-keystroke FE input matching everything via case-insensitive regex")
    void short_search_normalized_to_no_search() {
        Notification welcome = mongoTemplate.save(NotificationFixtures.basic("welcome"));
        Notification alert = mongoTemplate.save(NotificationFixtures.basic("alert"));
        readStateService.createForAudience(welcome.getId(), NotificationCategory.TICKETS, U, Set.of(ALICE));
        readStateService.createForAudience(alert.getId(), NotificationCategory.TICKETS, U, Set.of(ALICE));

        var page = notificationService.list(ALICE, U, new NotificationFilter(null, "a"), page10());

        assertThat(page.getItems()).extracting(NotificationView::id)
                .containsExactlyInAnyOrder(welcome.getId(), alert.getId());
    }

    @Test
    @DisplayName("Given a whitespace-only search term, when list is called, then it is normalized to no-search after trim and the full page is returned — pre-fix the raw regex would have searched on the unstripped whitespace")
    void whitespace_search_normalized_to_no_search() {
        Notification n = mongoTemplate.save(NotificationFixtures.basic("welcome"));
        readStateService.createForAudience(n.getId(), NotificationCategory.TICKETS, U, Set.of(ALICE));

        var page = notificationService.list(ALICE, U, new NotificationFilter(null, "   "), page10());

        assertThat(page.getItems()).hasSize(1);
    }

    @Test
    @DisplayName("Given enough orphan read_states to exhaust the streaming search's iteration cap (no matching notifications doc → 0 matches per batch), when list is called with a search term, then PageInfo.hasNextPage=true and endCursor encodes the streaming resumeCursor — caller can keep scrolling even though the page itself is empty (truncation propagates as cursor, not as `false hasNextPage`)")
    void search_truncation_propagates_to_page_info_with_resume_cursor() {
        int orphanRows = 7200;
        List<NotificationReadState> rows = new ArrayList<>(orphanRows);
        for (int i = 0; i < orphanRows; i++) {
            rows.add(NotificationReadState.builder()
                    .recipientId(ALICE)
                    .recipientType(U)
                    .notificationId(new ObjectId().toHexString())
                    .status(ReadStatus.UNREAD)
                    .category(NotificationCategory.GENERIC)
                    .build());
        }
        mongoTemplate.insert(rows, NotificationReadState.class);

        GenericQueryResult<NotificationView> result = notificationService.list(
                ALICE, U, new NotificationFilter(null, "doesnotmatch"), page10());

        assertThat(result.getItems()).isEmpty();
        assertThat(result.getPageInfo().isHasNextPage()).isTrue();
        assertThat(result.getPageInfo().getEndCursor()).isNotNull();
    }

    @Test
    @DisplayName("Given a read_state row soft-deleted by the caller, when list is called with no read filter, then the row does not appear in the page — deleted state hides notifications from default listings")
    void deleted_excluded() {
        Notification n = mongoTemplate.save(NotificationFixtures.basic());
        readStateService.createForAudience(n.getId(), NotificationCategory.TICKETS, U, Set.of(ALICE));
        readStateService.deleteNotification(ALICE, U, n.getId());

        assertThat(notificationService.list(ALICE, U, NotificationFilter.EMPTY, page10()).getItems()).isEmpty();
    }
}
