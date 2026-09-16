package com.openframe.test.tests;

import com.openframe.test.api.NotificationApi;
import com.openframe.test.api.TicketApi;
import com.openframe.test.data.dto.notification.Notification;
import com.openframe.test.data.dto.notification.NotificationConnection;
import com.openframe.test.data.dto.notification.UnreadCategoryCount;
import com.openframe.test.data.dto.ticket.Ticket;
import com.openframe.test.data.dto.ticket.TicketConnection;
import com.openframe.test.data.generator.TicketGenerator;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.List;
import java.util.Set;

import static com.openframe.test.data.generator.CursorGenerator.limit;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * The caller's notification inbox over the GraphQL API (coverage plan item CP-5): listing and
 * counts, marking one notification read and deleting it, marking a ticket's notifications read,
 * and the bulk mark-all / delete-all-read operations.
 * <p>
 * The product never notifies a user about their own actions (ticket assignment and status changes
 * skip the actor), so this class cannot mint a notification for itself; it works on whatever the
 * inbox holds. By decision of the suite owner (2026-09-13) the bulk operations run on every
 * tenant, including the shared qa one: the last case empties the inbox of the test user.
 * <p>
 * Hence {@code @Tag("notification")}: it is what lets the runner place this class in a phase of
 * its own, after {@code mingo}, rather than in the catch-all {@code functional} phase. A pipeline
 * run registers a fresh tenant, so its inbox starts empty and only that run can fill it. Nothing
 * before {@code mingo} does: on the 2026-09-16 qa nightly the phases up to and including
 * {@code fae} raised no ADMIN approval at all, while {@code mingo} raised 28, and every one of
 * those mints a notification (the chat dispatcher skips only {@code ApprovalType.CLIENT}, which it
 * treats as user-resolvable). Run before {@code mingo}, case 2 found nothing to mark and aborted
 * on its assumption; run after it, there is plenty to work on.
 * <p>
 * The tag does not help the feature-branch pipeline, which has no {@code mingo} phase: there this
 * class still depends on what the shared tenant happens to hold, and case 2 still self-skips when
 * an earlier run has drained it.
 */
@Tag("saas")
@Tag("notification")
@DisplayName("Notifications")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class NotificationsTest extends BaseTest {

    private static final RunId RUN_ID = RunId.next();
    private static final Set<String> CATEGORIES = Set.of("DASHBOARD", "CUSTOMERS", "DEVICES", "SCRIPTS",
            "MONITORING", "SOFTWARE", "LOGS", "TICKETS", "MINGO", "GENERIC");
    private static final Set<String> SEVERITIES = Set.of("INFO", "SUCCESS", "WARNING", "DANGER");
    private static final int PAGE = 50;

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("List notifications and read the unread counts")
    @Order(1)
    public void testListAndCounts() {
        NotificationConnection page = NotificationApi.listNotifications(null, PAGE);
        assertThat(page.getPageInfo()).as("A connection carries pageInfo").isNotNull();
        assertThat(page.nodes()).allSatisfy(n -> {
            assertThat(n.getId()).as("Every notification has an id").isNotBlank();
            assertThat(n.getTitle()).as("Every notification has a title (" + n.getId() + ")").isNotBlank();
            assertThat(n.getSeverity()).as("Severity is a schema value (" + n.getId() + ")").isIn(SEVERITIES);
            assertThat(n.getCategory()).as("Category is a schema value (" + n.getId() + ")").isIn(CATEGORIES);
            assertThat(n.getRead()).as("read is always present (" + n.getId() + ")").isNotNull();
            assertThat(n.getCreatedAt()).as("createdAt is always present (" + n.getId() + ")").isNotBlank();
        });

        List<UnreadCategoryCount> counts = NotificationApi.unreadCounts();
        assertThat(counts).allSatisfy(c -> {
            assertThat(c.getCategory()).as("Count category is a schema value").isIn(CATEGORIES);
            assertThat(c.getCount()).as("Counts are never negative").isGreaterThanOrEqualTo(0);
        });
        int unread = counts.stream().mapToInt(UnreadCategoryCount::getCount).sum();
        assertThat(NotificationApi.hasUnread()).as("hasUnreadNotifications agrees with the counts").isEqualTo(unread > 0);

        NotificationConnection unreadPage = NotificationApi.listUnread(PAGE);
        assertThat(unreadPage.nodes()).allSatisfy(n -> assertThat(n.getRead()).as("read:false lists only unread").isFalse());
        assertThat(unreadPage.nodes()).as("The unread page matches the counts").hasSize(Math.min(unread, PAGE));
        assertThat(NotificationApi.listRead(PAGE).nodes())
                .allSatisfy(n -> assertThat(n.getRead()).as("read:true lists only read").isTrue());
    }

    @Tag("feature")
    @Test
    @DisplayName("Mark a notification read, then delete it")
    @Order(2)
    public void testMarkReadAndDelete() {
        Notification target = NotificationApi.listUnread(1).nodes().stream().findFirst()
                .orElseGet(() -> NotificationApi.listNotifications(null, 1).nodes().stream().findFirst().orElse(null));
        assumeTrue(target != null, "The inbox is empty and the product never notifies a user about their own actions;"
                + " nothing to mark or delete" + orgSuffix());
        boolean wasUnread = Boolean.FALSE.equals(target.getRead());
        int categoryBefore = countFor(target.getCategory());

        assertThat(NotificationApi.markRead(target.getId())).as("Marking an existing notification read returns true").isTrue();
        Notification after = NotificationApi.find(target.getId(), target.getTitle());
        assertThat(after).as("The notification still exists after being read").isNotNull();
        assertThat(after.getRead()).as("The notification is read").isTrue();
        assertThat(countFor(target.getCategory()))
                .as("The category's unread count drops by one when the notification was unread")
                .isEqualTo(wasUnread ? categoryBefore - 1 : categoryBefore);
        NotificationApi.markRead(target.getId());
        assertThat(NotificationApi.find(target.getId(), target.getTitle()).getRead()).as("Marking read again keeps it read").isTrue();

        assertThat(NotificationApi.delete(target.getId())).as("Deleting an existing notification returns true").isTrue();
        assertThat(NotificationApi.find(target.getId(), target.getTitle())).as("A deleted notification is gone").isNull();
        assertThat(NotificationApi.listNotifications(null, PAGE).ids()).as("It left the inbox").doesNotContain(target.getId());
        assertThat(NotificationApi.delete(target.getId())).as("Deleting it again returns false").isFalse();
    }

    @Tag("feature")
    @Test
    @DisplayName("Mark a ticket's notifications read")
    @Order(3)
    public void testMarkReadForTicket() {
        TicketConnection tickets = TicketApi.getTickets(TicketGenerator.activeTickets(), limit(1));
        Ticket ticket = tickets == null || tickets.getEdges() == null || tickets.getEdges().isEmpty()
                ? null : TicketGenerator.firstTicket(tickets);
        String entityId = ticket != null ? ticket.getId() : "e2e-" + RUN_ID + "-no-such-ticket";
        int before = NotificationApi.totalUnread();

        long marked = NotificationApi.markReadForEntity("TICKET", entityId);
        assertThat(marked).as("The mutation reports how many notifications it marked").isGreaterThanOrEqualTo(0);
        int after = NotificationApi.totalUnread();
        assertThat(after).as("Unread counts never grow from marking read").isLessThanOrEqualTo(before);
        assertThat((long) (before - after)).as("The counts drop by at most the reported number").isLessThanOrEqualTo(marked);

        assertThat(NotificationApi.markReadForEntity("TICKET", entityId))
                .as("Marking the same ticket again finds nothing unread").isZero();
    }

    @Tag("feature")
    @Tag("destructive")
    @Test
    @DisplayName("Mark everything read and delete the read notifications")
    @Order(4)
    public void testBulkReadAndDelete() {
        int unreadBefore = NotificationApi.totalUnread();
        long marked = NotificationApi.markAllRead();
        assertThat(marked).as("markAll reports at least the notifications that were unread before it").isGreaterThanOrEqualTo(unreadBefore);
        assertThat(NotificationApi.unreadCounts()).allSatisfy(c -> assertThat(c.getCount()).as("No unread left in " + c.getCategory()).isZero());
        assertThat(NotificationApi.hasUnread()).as("hasUnreadNotifications is false after markAll").isFalse();
        assertThat(NotificationApi.listUnread(PAGE).nodes()).as("The unread page is empty").isEmpty();
        assertThat(NotificationApi.markAllRead()).as("markAll on an all-read inbox changes nothing").isZero();

        int readBefore = NotificationApi.listRead(PAGE).nodes().size();
        long deleted = NotificationApi.deleteAllRead();
        assertThat(deleted).as("deleteAllRead removes at least the read page seen before it").isGreaterThanOrEqualTo(readBefore);
        assertThat(NotificationApi.listRead(PAGE).nodes()).as("No read notifications remain").isEmpty();
        assertThat(NotificationApi.listNotifications(null, PAGE).nodes()).as("The inbox is empty").isEmpty();
        assertThat(NotificationApi.deleteAllRead()).as("deleteAllRead on an empty inbox removes nothing").isZero();
    }

    private static int countFor(String category) {
        return NotificationApi.unreadCounts().stream()
                .filter(c -> category.equals(c.getCategory()))
                .mapToInt(UnreadCategoryCount::getCount)
                .findFirst().orElse(0);
    }
}
