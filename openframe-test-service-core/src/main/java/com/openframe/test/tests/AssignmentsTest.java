package com.openframe.test.tests;

import com.openframe.test.api.AssignmentApi;
import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.KnowledgeBaseApi;
import com.openframe.test.api.TicketApi;
import com.openframe.test.data.dto.assignment.AssignedItemCount;
import com.openframe.test.data.dto.assignment.AssignmentItemType;
import com.openframe.test.data.dto.assignment.AssignmentTargetType;
import com.openframe.test.data.dto.assignment.ItemAssignment;
import com.openframe.test.data.dto.assignment.ItemAssignmentConnection;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.knowledgebase.KnowledgeBaseItem;
import com.openframe.test.data.dto.shared.SortInput;
import com.openframe.test.data.dto.ticket.CreateTicketInput;
import com.openframe.test.data.dto.ticket.Ticket;
import com.openframe.test.helpers.RelayIds;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.data.dto.assignment.AssignmentTargetType.DEVICE;
import static com.openframe.test.data.dto.assignment.AssignmentTargetType.KNOWLEDGE_ARTICLE;
import static com.openframe.test.data.dto.assignment.AssignmentTargetType.ORGANIZATION;
import static com.openframe.test.data.dto.assignment.AssignmentTargetType.TICKET;
import static com.openframe.test.data.generator.DeviceGenerator.osDevicesFilter;
import static com.openframe.test.data.generator.KnowledgeBaseGenerator.deleteFolderArchivingChildren;
import static com.openframe.test.data.generator.KnowledgeBaseGenerator.draftArticle;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

// Item assignments (CP-37): one article of this class's own is assigned a ticket, two articles and the qa Windows box, then unassigned.
@Tag("saas")
@Tag("feature")
@Tag("assignments")
@DisplayName("Item assignments")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class AssignmentsTest extends BaseTest {

    private static final String WINDOWS_BOX = "vm115982";
    private static final RunId RUN_ID = RunId.next();
    private static final String PREFIX = "E2E assignment " + RUN_ID;
    private static final String ITEM_NAME = PREFIX + " item";
    private static final String FIRST_TARGET_NAME = PREFIX + " target 1";
    private static final String SECOND_TARGET_NAME = PREFIX + " target 2";
    private static final String TICKET_TITLE = PREFIX + " ticket";

    private static String folderId;
    private static String itemId;
    private static String firstArticleId;
    private static String secondArticleId;
    private static Ticket ticket;
    private static String ticketId;
    private static String resolvedStatusId;
    private static String archivedStatusId;
    private static Machine device;

    // Assignments this class made and has not yet removed, by target global id.
    private static final Map<String, AssignmentTargetType> assigned = new LinkedHashMap<>();
    private static boolean ticketUnassigned;

    @BeforeAll
    public static void createFixtures() {
        folderId = KnowledgeBaseApi.createFolder(PREFIX, null).getId();
        itemId = KnowledgeBaseApi.createArticle(draftArticle(folderId, ITEM_NAME)).getId();
        firstArticleId = KnowledgeBaseApi.createArticle(draftArticle(folderId, FIRST_TARGET_NAME)).getId();
        secondArticleId = KnowledgeBaseApi.createArticle(draftArticle(folderId, SECOND_TARGET_NAME)).getId();
        ticket = TicketApi.createTicket(CreateTicketInput.builder()
                .title(TICKET_TITLE)
                .description("created by the E2E suite to be an assignment target")
                .build());
        // The assignment mutations take the api-service's Ticket global id. The ai-agent answers a raw
        // ticket id, or a global one once it has migrated, so build it from the raw id either way.
        ticketId = RelayIds.toGlobalId("Ticket", RelayIds.raw(ticket.getId()));
        resolvedStatusId = TicketApi.resolveSystemStatusId("RESOLVED");
        archivedStatusId = TicketApi.resolveSystemStatusId("ARCHIVED");
        Machine found = DeviceApi.searchDevice(osDevicesFilter("WINDOWS"), WINDOWS_BOX);
        device = found != null && WINDOWS_BOX.equalsIgnoreCase(found.getHostname()) ? found : null;
    }

    @Test
    @Tag("read")
    @DisplayName("A new article has no assignments")
    @Order(1)
    public void testNewArticleHasNoAssignments() {
        List<AssignedItemCount> counts = AssignmentApi.assignedItemCounts(itemId);
        ItemAssignmentConnection tickets = AssignmentApi.assignedItems(itemId, TICKET);

        assertThat(counts).as("A new article has no per-type counts").isEmpty();
        assertThat(tickets.getFilteredCount()).as("A new article has no assigned tickets").isZero();
        assertThat(tickets.nodes()).as("The ticket list of a new article is empty").isEmpty();
    }

    @Test
    @DisplayName("Assign a ticket to an article")
    @Order(2)
    public void testAssignTicket() {
        ItemAssignment assignment = AssignmentApi.assignItem(itemId, AssignmentItemType.KNOWLEDGE_ARTICLE, TICKET, ticketId);
        assigned.put(ticketId, TICKET);

        assertThat(RelayIds.decode(assignment.getId())).as("The assignment id is an ItemAssignment global id")
                .startsWith("ItemAssignment:");
        assertThat(assignment.getItemType()).as("The item type is stored").isEqualTo(AssignmentItemType.KNOWLEDGE_ARTICLE);
        assertThat(assignment.getTargetType()).as("The target type is stored").isEqualTo(TICKET);
        assertThat(assignment.getDisplayName()).as("A ticket is named <number> - <title>")
                .isEqualTo(ticket.getTicketNumber() + " - " + TICKET_TITLE);
        assertThat(assignment.getCreatedAt()).as("The assignment is timestamped").isNotNull();
        assertThat(assignment.getTarget().getTypename()).as("The target resolves as a Ticket").isEqualTo("Ticket");
        assertThat(assignment.getTarget().getId()).as("The target id is the ticket's global id").isEqualTo(ticketId);
        assertThat(assignment.getTarget().getTicketNumber()).as("The target carries the ticket number")
                .isEqualTo(ticket.getTicketNumber());
        assertThat(assignment.getTarget().getTitle()).as("The target carries the ticket title").isEqualTo(TICKET_TITLE);
        assertThat(assignment.getTarget().getStatusKind()).as("The target carries the lifecycle kind").isNotNull();
    }

    @Test
    @DisplayName("Assign two articles to an article")
    @Order(3)
    public void testAssignArticles() {
        ItemAssignment first = AssignmentApi.assignItem(itemId, AssignmentItemType.KNOWLEDGE_ARTICLE, KNOWLEDGE_ARTICLE, firstArticleId);
        assigned.put(firstArticleId, KNOWLEDGE_ARTICLE);
        ItemAssignment second = AssignmentApi.assignItem(itemId, AssignmentItemType.KNOWLEDGE_ARTICLE, KNOWLEDGE_ARTICLE, secondArticleId);
        assigned.put(secondArticleId, KNOWLEDGE_ARTICLE);

        assertThat(first.getDisplayName()).as("An article is named by its title").isEqualTo(FIRST_TARGET_NAME);
        assertThat(first.getTarget().getTypename()).as("The target resolves as a KnowledgeBaseItem").isEqualTo("KnowledgeBaseItem");
        assertThat(first.getTarget().getId()).as("The target id is the article's global id").isEqualTo(firstArticleId);
        assertThat(first.getTarget().getName()).as("The target carries the article name").isEqualTo(FIRST_TARGET_NAME);
        assertThat(second.getDisplayName()).as("The second article is named by its title").isEqualTo(SECOND_TARGET_NAME);
        assertThat(second.getTarget().getId()).as("The second target id is that article's global id").isEqualTo(secondArticleId);
        assertThat(second.getId()).as("Each assignment gets its own id").isNotEqualTo(first.getId());
    }

    @Test
    @DisplayName("Assign the qa Windows box to an article")
    @Order(4)
    public void testAssignDevice() {
        assumeTrue(device != null, "The qa Windows box " + WINDOWS_BOX + " is not listed");

        ItemAssignment assignment = AssignmentApi.assignItem(itemId, AssignmentItemType.KNOWLEDGE_ARTICLE, DEVICE, device.getId());
        assigned.put(device.getId(), DEVICE);

        assertThat(assignment.getTargetType()).as("The target type is stored").isEqualTo(DEVICE);
        assertThat(assignment.getDisplayName()).as("A device is named by its hostname").isEqualTo(device.getHostname());
        assertThat(assignment.getTarget().getTypename()).as("The target resolves as a Machine").isEqualTo("Machine");
        assertThat(assignment.getTarget().getId()).as("The target id is the device's global id").isEqualTo(device.getId());
        assertThat(assignment.getTarget().getMachineId()).as("The target carries the machine id").isEqualTo(device.getMachineId());
        assertThat(assignment.getTarget().getHostname()).as("The target carries the hostname").isEqualTo(device.getHostname());
    }

    @Test
    @Tag("read")
    @DisplayName("List an article's assignments per target type")
    @Order(5)
    public void testListAssignmentsByTargetType() {
        requireTicketAndArticlesAssigned();

        ItemAssignmentConnection articles = AssignmentApi.assignedItems(itemId, KNOWLEDGE_ARTICLE);
        ItemAssignmentConnection tickets = AssignmentApi.assignedItems(itemId, TICKET);
        ItemAssignmentConnection organizations = AssignmentApi.assignedItems(itemId, ORGANIZATION);

        assertThat(articles.targetIds()).as("The article list holds exactly the two assigned articles")
                .containsExactlyInAnyOrder(firstArticleId, secondArticleId);
        assertThat(articles.getFilteredCount()).as("The article list counts two").isEqualTo(2);
        assertThat(articles.nodes()).as("Every listed article assignment is of the article type")
                .allSatisfy(node -> assertThat(node.getTargetType()).isEqualTo(KNOWLEDGE_ARTICLE));
        assertThat(tickets.targetIds()).as("The ticket list holds exactly the assigned ticket").containsExactly(ticketId);
        assertThat(tickets.getFilteredCount()).as("The ticket list counts one").isEqualTo(1);
        assertThat(organizations.nodes()).as("No organization was assigned").isEmpty();
        assertThat(organizations.getFilteredCount()).as("The organization list counts zero").isZero();
    }

    @Test
    @Tag("read")
    @DisplayName("Search, sort and page an article's assignments")
    @Order(6)
    public void testSearchSortAndPage() {
        requireTicketAndArticlesAssigned();
        SortInput byNameAscending = SortInput.builder().field("displayName").direction("ASC").build();
        SortInput byNameDescending = SortInput.builder().field("displayName").direction("DESC").build();

        ItemAssignmentConnection searched = AssignmentApi.assignedItems(itemId, KNOWLEDGE_ARTICLE, FIRST_TARGET_NAME, null, null, null);
        ItemAssignmentConnection firstPage = AssignmentApi.assignedItems(itemId, KNOWLEDGE_ARTICLE, null, byNameAscending, 1, null);
        ItemAssignmentConnection secondPage = AssignmentApi.assignedItems(itemId, KNOWLEDGE_ARTICLE, null, byNameAscending, 1,
                firstPage.getPageInfo().getEndCursor());
        ItemAssignmentConnection descending = AssignmentApi.assignedItems(itemId, KNOWLEDGE_ARTICLE, null, byNameDescending, 1, null);

        assertThat(searched.targetIds()).as("Searching by name finds only that article").containsExactly(firstArticleId);
        assertThat(searched.getFilteredCount()).as("The search counts one match").isEqualTo(1);
        assertThat(firstPage.targetIds()).as("Ascending by name, the first page holds target 1").containsExactly(firstArticleId);
        assertThat(firstPage.getFilteredCount()).as("A page still counts every match").isEqualTo(2);
        assertThat(firstPage.getPageInfo().getHasNextPage()).as("The first page has a next page").isTrue();
        assertThat(secondPage.targetIds()).as("The page after the cursor holds target 2").containsExactly(secondArticleId);
        assertThat(secondPage.getPageInfo().getHasNextPage()).as("The second page is the last").isFalse();
        assertThat(secondPage.getPageInfo().getHasPreviousPage()).as("A page after a cursor has a previous page").isTrue();
        assertThat(descending.targetIds()).as("Descending by name, target 2 comes first").containsExactly(secondArticleId);
    }

    @Test
    @Tag("read")
    @DisplayName("Assigned item counts agree with the per-type lists")
    @Order(7)
    public void testCountsAgreeWithLists() {
        requireTicketAndArticlesAssigned();
        Map<AssignmentTargetType, Integer> expected = new EnumMap<>(AssignmentTargetType.class);
        assigned.values().forEach(type -> expected.merge(type, 1, Integer::sum));

        Map<AssignmentTargetType, Integer> counts = byType(AssignmentApi.assignedItemCounts(itemId));

        assertThat(counts).as("The counts hold one row per assigned target type, none for the rest").isEqualTo(expected);
        for (AssignmentTargetType type : AssignmentTargetType.values()) {
            ItemAssignmentConnection listed = AssignmentApi.assignedItems(itemId, type);
            assertThat(counts.getOrDefault(type, 0)).as("The %s count matches the %s list's filteredCount", type, type)
                    .isEqualTo(listed.getFilteredCount());
        }
    }

    @Test
    @DisplayName("Unassign a ticket from an article")
    @Order(8)
    public void testUnassignTicket() {
        requireAssigned(ticketId, "Assign a ticket to an article");

        Boolean unassigned = AssignmentApi.unassignItem(itemId, TICKET, ticketId);
        assigned.remove(ticketId);
        ticketUnassigned = true;

        assertThat(unassigned).as("unassignItem answers true").isTrue();
        assertThat(AssignmentApi.assignedItems(itemId, TICKET).nodes()).as("The ticket is no longer listed").isEmpty();
        assertThat(byType(AssignmentApi.assignedItemCounts(itemId))).as("The counts drop the ticket row")
                .doesNotContainKey(TICKET);
    }

    @Test
    @Tag("negative")
    @DisplayName("Unassigning a ticket that is no longer assigned changes nothing")
    @Order(9)
    public void testUnassignTicketAgain() {
        assumeTrue(ticketUnassigned, "No ticket was unassigned in \"Unassign a ticket from an article\"; see that failure");
        Map<AssignmentTargetType, Integer> before = byType(AssignmentApi.assignedItemCounts(itemId));

        Boolean unassigned = AssignmentApi.unassignItem(itemId, TICKET, ticketId);

        // The resolver answers true whether or not a row was deleted; this pins that.
        assertThat(unassigned).as("A repeated unassign is not an error and still answers true").isTrue();
        assertThat(byType(AssignmentApi.assignedItemCounts(itemId))).as("A repeated unassign leaves the counts as they were")
                .isEqualTo(before);
    }

    @Test
    @DisplayName("Unassign every article from an article at once")
    @Order(10)
    public void testUnassignAllArticles() {
        requireAssigned(firstArticleId, "Assign two articles to an article");
        requireAssigned(secondArticleId, "Assign two articles to an article");

        Boolean unassigned = AssignmentApi.unassignAllByType(itemId, KNOWLEDGE_ARTICLE);
        assigned.remove(firstArticleId);
        assigned.remove(secondArticleId);
        Map<AssignmentTargetType, Integer> counts = byType(AssignmentApi.assignedItemCounts(itemId));

        assertThat(unassigned).as("unassignAllByType answers true").isTrue();
        assertThat(AssignmentApi.assignedItems(itemId, KNOWLEDGE_ARTICLE).nodes()).as("No article is listed any more").isEmpty();
        assertThat(counts).as("The counts drop the article row").doesNotContainKey(KNOWLEDGE_ARTICLE);
        if (assigned.containsValue(DEVICE)) {
            assertThat(counts).as("Another target type is left assigned").containsEntry(DEVICE, 1);
        }
        KnowledgeBaseItem target = KnowledgeBaseApi.getKnowledgeBaseItem(firstArticleId);
        assertThat(target.getName()).as("Unassigning removes the link, not the target article").isEqualTo(FIRST_TARGET_NAME);
    }

    @Test
    @DisplayName("Unassign the qa Windows box from an article")
    @Order(11)
    public void testUnassignDevice() {
        assumeTrue(device != null && assigned.containsKey(device.getId()),
                "The qa Windows box was not assigned in \"Assign the qa Windows box to an article\"");

        Boolean unassigned = AssignmentApi.unassignItem(itemId, DEVICE, device.getId());
        assigned.remove(device.getId());

        assertThat(unassigned).as("unassignItem answers true").isTrue();
        assertThat(AssignmentApi.assignedItems(itemId, DEVICE).nodes()).as("The device is no longer listed").isEmpty();
        assertThat(AssignmentApi.assignedItemCounts(itemId)).as("With nothing left assigned the counts are empty").isEmpty();
    }

    // Removes assignments a failed case left behind, then the fixtures: the folder delete archives the three articles, the ticket is archived.
    @AfterAll
    public static void cleanup() {
        assigned.forEach((targetId, type) -> AssignmentApi.unassignItemRaw(itemId, type, targetId));
        if (folderId != null) {
            KnowledgeBaseApi.deleteFolderRaw(deleteFolderArchivingChildren(folderId));
        }
        if (ticket != null && resolvedStatusId != null && archivedStatusId != null) {
            TicketApi.transitionTicketRaw(ticket.getId(), resolvedStatusId);
            TicketApi.transitionTicketRaw(ticket.getId(), archivedStatusId);
        }
    }

    private static void requireTicketAndArticlesAssigned() {
        requireAssigned(ticketId, "Assign a ticket to an article");
        requireAssigned(firstArticleId, "Assign two articles to an article");
        requireAssigned(secondArticleId, "Assign two articles to an article");
    }

    private static void requireAssigned(String targetId, String assigningCase) {
        assumeTrue(targetId != null && assigned.containsKey(targetId),
                "The target was not assigned in \"" + assigningCase + "\"; see that failure");
    }

    private static Map<AssignmentTargetType, Integer> byType(List<AssignedItemCount> counts) {
        Map<AssignmentTargetType, Integer> byType = new EnumMap<>(AssignmentTargetType.class);
        counts.forEach(count -> byType.put(count.getTargetType(), count.getCount()));
        return byType;
    }
}
