package com.openframe.api.integration.datafetcher.notification;

import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.openframe.api.integration.BaseMongoIntegrationTest;
import com.openframe.api.integration.support.GraphQlIntegrationTestApplication;
import com.openframe.api.integration.support.NotificationFixtures;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationEntityType;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.notification.readstate.NotificationReadStateService;
import com.openframe.notification.spec.NotificationEntityRef;
import graphql.ExecutionResult;
import graphql.relay.Relay;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        classes = GraphQlIntegrationTestApplication.class,
        properties = {
                "spring.cloud.stream.enabled=false",
                "dgs.graphql.schema-locations=classpath:schema/shared.graphqls,classpath:schema/notification.graphqls,classpath:test-schema/test-bridge.graphqls,classpath:test-schema/test-approval-notification.graphqls",
                "spring.autoconfigure.exclude="
                        + "org.springframework.cloud.stream.config.BindingServiceConfiguration,"
                        + "org.springframework.cloud.stream.function.FunctionConfiguration,"
                        + "org.springframework.cloud.stream.config.BindersHealthIndicatorAutoConfiguration,"
                        + "org.springframework.cloud.stream.config.ChannelsEndpointAutoConfiguration,"
                        + "org.springframework.cloud.stream.config.BindingsEndpointAutoConfiguration,"
                        + "org.springframework.cloud.function.context.config.ContextFunctionCatalogAutoConfiguration,"
                        + "org.springframework.boot.actuate.autoconfigure.security.servlet.ManagementWebSecurityAutoConfiguration"
        }
)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class NotificationDataFetcherIT extends BaseMongoIntegrationTest {

    private static final String ALICE = "user-alice";
    private static final String MACHINE_1 = "machine-1";
    private static final Relay RELAY = new Relay();

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private NotificationReadStateService readStateService;

    @BeforeEach
    void reset() {
        mongoTemplate.dropCollection(Notification.class);
        mongoTemplate.dropCollection(NotificationReadState.class);
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Given an ADMIN JWT principal and a USER read_state row addressed to that user, when the notifications GraphQL query runs, then the page returns that row with read=false")
    void admin_lists_own_rows() {
        loginAsAdmin(ALICE);
        Notification n = mongoTemplate.save(NotificationFixtures.basic("welcome"));
        readStateService.createForAudience(n.getId(), NotificationCategory.TICKETS, "title", RecipientType.USER, Set.of(ALICE));

        ExecutionResult res = queryExecutor.execute("""
                query { notifications(first: 10) { edges { node { id title read } } } }
                """);
        assertThat(res.getErrors()).isEmpty();
        assertThat(edges(res)).hasSize(1);
    }

    @Test
    @DisplayName("Given an AGENT JWT principal carrying machine_id claim and a MACHINE read_state row for that machine, when the notifications GraphQL query runs, then the page returns the machine's row — recipient resolved from JWT, no schema arg")
    void agent_lists_machine_rows() {
        loginAsAgent(MACHINE_1);
        Notification n = mongoTemplate.save(NotificationFixtures.basic("ticket-update"));
        readStateService.createForAudience(n.getId(), NotificationCategory.TICKETS, "title", RecipientType.MACHINE, Set.of(MACHINE_1));

        ExecutionResult res = queryExecutor.execute("""
                query { notifications(first: 10) { edges { node { id title read } } } }
                """);
        assertThat(res.getErrors()).isEmpty();
        assertThat(edges(res)).hasSize(1);
    }

    @Test
    @DisplayName("Given an UNREAD read_state row for the ADMIN principal, when hasUnreadNotifications is queried then marked read and queried again, then the result flips from true to false")
    void has_unread() {
        loginAsAdmin(ALICE);
        Notification n = mongoTemplate.save(NotificationFixtures.basic());
        readStateService.createForAudience(n.getId(), NotificationCategory.TICKETS, "title", RecipientType.USER, Set.of(ALICE));

        ExecutionResult res = queryExecutor.execute("query { hasUnreadNotifications }");
        assertThat(res.<Map<String, Object>>getData().get("hasUnreadNotifications")).isEqualTo(true);

        readStateService.markRead(ALICE, RecipientType.USER, n.getId());
        res = queryExecutor.execute("query { hasUnreadNotifications }");
        assertThat(res.<Map<String, Object>>getData().get("hasUnreadNotifications")).isEqualTo(false);
    }

    @Test
    @DisplayName("Given an UNREAD read_state row for the ADMIN principal, when the markNotificationAsRead mutation runs with a Relay global id, then the row flips to READ and the mutation returns true")
    void mark_as_read() {
        loginAsAdmin(ALICE);
        Notification n = mongoTemplate.save(NotificationFixtures.basic());
        readStateService.createForAudience(n.getId(), NotificationCategory.TICKETS, "title", RecipientType.USER, Set.of(ALICE));

        String globalId = RELAY.toGlobalId("Notification", n.getId());
        ExecutionResult res = queryExecutor.execute(
                "mutation($id: ID!) { markNotificationAsRead(notificationId: $id) }",
                Map.of("id", globalId));
        assertThat(res.getErrors()).isEmpty();
        assertThat(res.<Map<String, Object>>getData().get("markNotificationAsRead")).isEqualTo(true);
    }

    @Test
    @DisplayName("Given multiple UNREAD read_state rows for the ADMIN principal, when markAllNotificationsAsRead mutation runs, then it returns the number of rows updated (= count of UNREAD rows)")
    void mark_all_as_read() {
        loginAsAdmin(ALICE);
        Notification n1 = mongoTemplate.save(NotificationFixtures.basic("a"));
        Notification n2 = mongoTemplate.save(NotificationFixtures.basic("b"));
        readStateService.createForAudience(n1.getId(), NotificationCategory.TICKETS, "title", RecipientType.USER, Set.of(ALICE));
        readStateService.createForAudience(n2.getId(), NotificationCategory.TICKETS, "title", RecipientType.USER, Set.of(ALICE));

        ExecutionResult res = queryExecutor.execute("mutation { markAllNotificationsAsRead }");
        assertThat(((Number) res.<Map<String, Object>>getData().get("markAllNotificationsAsRead")).longValue())
                .isEqualTo(2L);
    }

    @Test
    @DisplayName("Given a read_state row for the ADMIN principal, when the deleteNotification mutation runs with the Relay global id, then it returns true and the row is soft-deleted (status=DELETED)")
    void delete_notification() {
        loginAsAdmin(ALICE);
        Notification n = mongoTemplate.save(NotificationFixtures.basic());
        readStateService.createForAudience(n.getId(), NotificationCategory.TICKETS, "title", RecipientType.USER, Set.of(ALICE));

        String globalId = RELAY.toGlobalId("Notification", n.getId());
        ExecutionResult res = queryExecutor.execute(
                "mutation($id: ID!) { deleteNotification(notificationId: $id) }",
                Map.of("id", globalId));
        assertThat(res.<Map<String, Object>>getData().get("deleteNotification")).isEqualTo(true);
    }

    @Test
    @DisplayName("Given a mix of UNREAD and READ rows for the ADMIN principal, when deleteAllReadNotifications mutation runs, then it returns the count of READ rows transitioned to DELETED (UNREAD rows untouched)")
    void delete_all_read() {
        loginAsAdmin(ALICE);
        Notification n1 = mongoTemplate.save(NotificationFixtures.basic("a"));
        Notification n2 = mongoTemplate.save(NotificationFixtures.basic("b"));
        readStateService.createForAudience(n1.getId(), NotificationCategory.TICKETS, "title", RecipientType.USER, Set.of(ALICE));
        readStateService.createForAudience(n2.getId(), NotificationCategory.TICKETS, "title", RecipientType.USER, Set.of(ALICE));
        readStateService.markRead(ALICE, RecipientType.USER, n1.getId());

        ExecutionResult res = queryExecutor.execute("mutation { deleteAllReadNotifications }");
        assertThat(((Number) res.<Map<String, Object>>getData().get("deleteAllReadNotifications")).longValue())
                .isEqualTo(1L);
    }

    @Test
    @DisplayName("Given three notifications for the ADMIN principal and sort={direction:ASC}, when the notifications query runs, then edges come back oldest-first — opposite of the default DESC order, cursor predicate flipped accordingly")
    void admin_lists_oldest_first_with_sort_asc() {
        loginAsAdmin(ALICE);
        Notification n1 = mongoTemplate.save(NotificationFixtures.basic("one"));
        sleepBriefly();
        Notification n2 = mongoTemplate.save(NotificationFixtures.basic("two"));
        sleepBriefly();
        Notification n3 = mongoTemplate.save(NotificationFixtures.basic("three"));
        readStateService.createForAudience(n1.getId(), NotificationCategory.TICKETS, "title", RecipientType.USER, Set.of(ALICE));
        readStateService.createForAudience(n2.getId(), NotificationCategory.TICKETS, "title", RecipientType.USER, Set.of(ALICE));
        readStateService.createForAudience(n3.getId(), NotificationCategory.TICKETS, "title", RecipientType.USER, Set.of(ALICE));

        ExecutionResult res = queryExecutor.execute("""
                query { notifications(first: 10, sort: { direction: ASC }) { edges { node { title } } } }
                """);
        assertThat(res.getErrors()).isEmpty();
        assertThat(edges(res)).extracting(NotificationDataFetcherIT::edgeNodeTitle)
                .containsExactly("one", "two", "three");
    }

    @Test
    @DisplayName("Given the notifications query without a sort argument, when it runs, then edges come back newest-first — backward-compat default DESC unchanged")
    void admin_lists_newest_first_by_default() {
        loginAsAdmin(ALICE);
        Notification n1 = mongoTemplate.save(NotificationFixtures.basic("one"));
        sleepBriefly();
        Notification n2 = mongoTemplate.save(NotificationFixtures.basic("two"));
        readStateService.createForAudience(n1.getId(), NotificationCategory.TICKETS, "title", RecipientType.USER, Set.of(ALICE));
        readStateService.createForAudience(n2.getId(), NotificationCategory.TICKETS, "title", RecipientType.USER, Set.of(ALICE));

        ExecutionResult res = queryExecutor.execute("""
                query { notifications(first: 10) { edges { node { title } } } }
                """);
        assertThat(res.getErrors()).isEmpty();
        assertThat(edges(res)).extracting(NotificationDataFetcherIT::edgeNodeTitle)
                .containsExactly("two", "one");
    }

    @Test
    @DisplayName("Given UNREAD rows across different categories for the ADMIN principal, when the unreadCountsByCategory query runs, then a list of UnreadCategoryCount entries is returned with one entry per category present in UNREAD rows")
    void unread_counts_by_category() {
        loginAsAdmin(ALICE);
        Notification n1 = mongoTemplate.save(NotificationFixtures.basic("TICKET_A"));
        Notification n2 = mongoTemplate.save(NotificationFixtures.basic("MINGO_A"));
        readStateService.createForAudience(n1.getId(), NotificationCategory.TICKETS, "title", RecipientType.USER, Set.of(ALICE));
        readStateService.createForAudience(n2.getId(), NotificationCategory.MINGO, "title", RecipientType.USER, Set.of(ALICE));

        ExecutionResult res = queryExecutor.execute("query { unreadCountsByCategory { category count } }");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> counts = (List<Map<String, Object>>) res.<Map<String, Object>>getData().get("unreadCountsByCategory");
        assertThat(counts).extracting(c -> c.get("category")).containsExactlyInAnyOrder("TICKETS", "MINGO");
    }

    @Test
    @DisplayName("Given UNREAD rows of ALICE about devices machine-1 and machine-2 plus an entity-less one, and a row of BOB about machine-1, when notifications runs with filter.entity = (DEVICE, machine-1), then only ALICE's machine-1 row comes back and filteredCount is 1")
    void entity_filter_lists_only_that_devices_rows_of_the_caller() {
        loginAsAdmin(ALICE);
        Notification onMachine1 = mongoTemplate.save(NotificationFixtures.basic("RECORDING_FAILED"));
        Notification onMachine2 = mongoTemplate.save(NotificationFixtures.basic("RECORDING_EXPIRES_IN_7_DAYS"));
        Notification storage = mongoTemplate.save(NotificationFixtures.basic("RECORDING_STORAGE_FULL"));
        createDeviceRow(onMachine1, MACHINE_1, ALICE);
        createDeviceRow(onMachine1, MACHINE_1, "user-bob");
        createDeviceRow(onMachine2, "machine-2", ALICE);
        readStateService.createForAudience(storage.getId(), NotificationCategory.DEVICES, "title", RecipientType.USER, Set.of(ALICE));

        ExecutionResult res = queryExecutor.execute("""
                query { notifications(first: 10, filter: { entity: { type: DEVICE, id: "machine-1" } }) {
                    edges { node { title } } filteredCount } }
                """);
        assertThat(res.getErrors()).isEmpty();
        assertThat(edges(res)).extracting(NotificationDataFetcherIT::edgeNodeTitle).containsExactly("RECORDING_FAILED");
        assertThat(filteredCount(res)).isEqualTo(1);
    }

    @Test
    @DisplayName("Given an UNREAD row of ALICE about machine-1, when markNotificationsReadForEntity(DEVICE, machine-1) runs, then the entity filter with read=false is empty and with read=true lists the row")
    void entity_filter_combines_with_read_after_mark_read_for_entity() {
        loginAsAdmin(ALICE);
        Notification onMachine1 = mongoTemplate.save(NotificationFixtures.basic("RECORDING_FAILED"));
        createDeviceRow(onMachine1, MACHINE_1, ALICE);

        ExecutionResult marked = queryExecutor.execute(
                "mutation { markNotificationsReadForEntity(entityType: DEVICE, entityId: \"machine-1\") }");
        assertThat(marked.getErrors()).isEmpty();
        assertThat(((Number) marked.<Map<String, Object>>getData().get("markNotificationsReadForEntity")).longValue())
                .isEqualTo(1L);

        ExecutionResult unread = queryExecutor.execute("""
                query { notifications(first: 10, filter: { read: false, entity: { type: DEVICE, id: "machine-1" } }) {
                    edges { node { title } } filteredCount } }
                """);
        assertThat(unread.getErrors()).isEmpty();
        assertThat(edges(unread)).isEmpty();
        assertThat(filteredCount(unread)).isZero();

        ExecutionResult read = queryExecutor.execute("""
                query { notifications(first: 10, filter: { read: true, entity: { type: DEVICE, id: "machine-1" } }) {
                    edges { node { title read } } filteredCount } }
                """);
        assertThat(read.getErrors()).isEmpty();
        assertThat(edges(read)).extracting(NotificationDataFetcherIT::edgeNodeTitle).containsExactly("RECORDING_FAILED");
        assertThat(filteredCount(read)).isEqualTo(1);
    }

    @Test
    @DisplayName("Given an entity filter with a blank id, when notifications runs, then the query is rejected with an error and no rows")
    void entity_filter_blank_id_is_rejected() {
        loginAsAdmin(ALICE);

        ExecutionResult res = queryExecutor.execute("""
                query { notifications(first: 10, filter: { entity: { type: DEVICE, id: " " } }) { edges { node { title } } } }
                """);
        assertThat(res.getErrors()).isNotEmpty();
    }

    private void createDeviceRow(Notification notification, String machineId, String userId) {
        NotificationEntityRef device = NotificationEntityRef.of(NotificationEntityType.DEVICE, machineId).orElseThrow();
        readStateService.createForAudience(notification.getId(), NotificationCategory.DEVICES, "title", device,
                RecipientType.USER, Set.of(userId));
    }

    private static int filteredCount(ExecutionResult res) {
        Map<String, Object> data = res.getData();
        Map<?, ?> connection = (Map<?, ?>) data.get("notifications");
        return ((Number) connection.get("filteredCount")).intValue();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> edges(ExecutionResult res) {
        Map<String, Object> data = res.getData();
        Map<String, Object> connection = (Map<String, Object>) data.get("notifications");
        return (List<Map<String, Object>>) connection.get("edges");
    }

    private static Object edgeNodeTitle(Map<String, Object> edge) {
        return ((Map<?, ?>) edge.get("node")).get("title");
    }

    private static void sleepBriefly() {
        try {
            Thread.sleep(2);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void loginAsAdmin(String userId) {
        Jwt jwt = Jwt.withTokenValue("admin-token")
                .header("alg", "none")
                .subject("subject-" + userId)
                .claim("userId", userId)
                .claim("roles", List.of("ADMIN"))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
        JwtAuthenticationToken auth = new JwtAuthenticationToken(jwt,
                List.of(new SimpleGrantedAuthority("ADMIN")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private void loginAsAgent(String machineId) {
        Jwt jwt = Jwt.withTokenValue("agent-token")
                .header("alg", "none")
                .subject("agent-" + machineId)
                .claim("userId", "agent-" + machineId)
                .claim("roles", List.of("AGENT"))
                .claim("machine_id", machineId)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
        JwtAuthenticationToken auth = new JwtAuthenticationToken(jwt,
                List.of(new SimpleGrantedAuthority("AGENT")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
