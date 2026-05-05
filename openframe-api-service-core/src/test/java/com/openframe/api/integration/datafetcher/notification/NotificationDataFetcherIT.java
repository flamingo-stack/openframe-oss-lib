package com.openframe.api.integration.datafetcher.notification;

import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.integration.BaseMongoIntegrationTest;
import com.openframe.api.integration.support.GraphQlIntegrationTestApplication;
import com.openframe.api.integration.support.NotificationFixtures;
import com.openframe.core.exception.UnauthorizedException;
import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.data.document.notification.RecipientScope;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.service.notification.NotificationReadStateService;
import graphql.ExecutionResult;
import graphql.relay.Relay;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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
    private static final String BOB = "user-bob";
    private static final Relay RELAY = new Relay();

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @Autowired
    private NotificationRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private NotificationReadStateService readStateService;

    @BeforeEach
    void resetCollectionAndAuth() {
        mongoTemplate.dropCollection(Notification.class);
        mongoTemplate.dropCollection(NotificationReadState.class);
        authAs(ALICE);
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Nested
    @DisplayName("hasUnreadNotifications query")
    class HasUnreadNotifications {

        @Test
        @DisplayName("Given an empty inbox, when querying hasUnreadNotifications, then it returns false")
        void given_empty_inbox_when_querying_has_unread_notifications_then_returns_false() {
            Boolean result = queryExecutor.executeAndExtractJsonPath(
                    "{ hasUnreadNotifications }", "data.hasUnreadNotifications");
            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("Given the caller has at least one unread notification, when querying hasUnreadNotifications, then it returns true")
        void given_caller_has_unread_when_querying_has_unread_notifications_then_returns_true() {
            repository.save(NotificationFixtures.basic(ALICE));

            Boolean result = queryExecutor.executeAndExtractJsonPath(
                    "{ hasUnreadNotifications }", "data.hasUnreadNotifications");
            assertThat(result).isTrue();
        }

        @Test
        @DisplayName("Given another user has unread but the authenticated caller does not, when querying hasUnreadNotifications, then it returns false — the resolver uses the JWT principal, not arbitrary input")
        void given_another_user_has_unread_when_querying_has_unread_notifications_then_returns_false_for_caller() {
            repository.save(NotificationFixtures.basic(BOB));

            Boolean result = queryExecutor.executeAndExtractJsonPath(
                    "{ hasUnreadNotifications }", "data.hasUnreadNotifications");
            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("Given only an unread tenant-wide broadcast and no direct rows for the caller, when querying hasUnreadNotifications via GraphQL, then it returns true — broadcasts feed into the bell badge through the data fetcher path")
        void given_only_unread_broadcast_when_querying_then_returns_true() {
            repository.save(Notification.builder()
                    .recipientScope(RecipientScope.ALL)
                    .title("Tenant-wide announcement")
                    .createdAt(Instant.now())
                    .context(GenericContext.builder().type("ann").payload("{}").build())
                    .build());

            Boolean result = queryExecutor.executeAndExtractJsonPath(
                    "{ hasUnreadNotifications }", "data.hasUnreadNotifications");
            assertThat(result).isTrue();
        }
    }

    @Nested
    @DisplayName("notifications query")
    class NotificationsQuery {

        @Test
        @DisplayName("Given a saved notification, when querying notifications, then each edge node id is a Relay-encoded global id pointing back at the raw row id")
        void given_saved_notification_when_querying_then_node_ids_are_relay_encoded() {
            Notification saved = repository.save(NotificationFixtures.basic(ALICE));

            String query = "{ notifications(first: 10) { edges { node { id context { type } } cursor } } }";
            List<Map<String, Object>> edges = queryExecutor.executeAndExtractJsonPath(
                    query, "data.notifications.edges");

            assertThat(edges).hasSize(1);
            Map<String, Object> node = (Map<String, Object>) edges.get(0).get("node");
            String relayId = (String) node.get("id");

            Relay.ResolvedGlobalId resolved = RELAY.fromGlobalId(relayId);
            assertThat(resolved.getType()).isEqualTo("Notification");
            assertThat(resolved.getId()).isEqualTo(saved.getId());
        }

        @Test
        @DisplayName("Given a saved notification, when querying notifications, then the edge cursor base64-decodes back to the raw notification id")
        void given_saved_notification_when_querying_then_edge_cursor_decodes_to_raw_id() {
            Notification saved = repository.save(NotificationFixtures.basic(ALICE));

            String query = "{ notifications(first: 10) { edges { cursor } } }";
            List<Map<String, Object>> edges = queryExecutor.executeAndExtractJsonPath(
                    query, "data.notifications.edges");

            String encodedCursor = (String) edges.get(0).get("cursor");
            assertThat(CursorCodec.decode(encodedCursor)).isEqualTo(saved.getId());
        }

        @Test
        @DisplayName("Given multiple pages of notifications, when paginating forward by feeding endCursor into `after`, then consecutive pages are disjoint")
        void given_multiple_pages_when_paginating_forward_then_consecutive_pages_are_disjoint() {
            List<Notification> seeded = seedSequential(ALICE, 5);

            String firstQuery = "{ notifications(first: 2) { edges { node { id } } pageInfo { hasNextPage endCursor } } }";
            Map<String, Object> first = queryExecutor.executeAndExtractJsonPath(
                    firstQuery, "data.notifications");
            Map<String, Object> firstPageInfo = (Map<String, Object>) first.get("pageInfo");
            assertThat(firstPageInfo.get("hasNextPage")).isEqualTo(true);
            String afterCursor = (String) firstPageInfo.get("endCursor");

            String secondQuery = String.format(
                    "{ notifications(first: 2, after: \"%s\") { edges { node { id } } pageInfo { hasNextPage } } }",
                    afterCursor);
            Map<String, Object> second = queryExecutor.executeAndExtractJsonPath(
                    secondQuery, "data.notifications");

            List<Map<String, Object>> firstEdges = (List<Map<String, Object>>) first.get("edges");
            List<Map<String, Object>> secondEdges = (List<Map<String, Object>>) second.get("edges");
            assertThat(firstEdges).hasSize(2);
            assertThat(secondEdges).hasSize(2);
            assertThat(extractIds(firstEdges)).doesNotContainAnyElementsOf(extractIds(secondEdges));
        }

        @Test
        @DisplayName("Given another user owns a notification, when the caller queries notifications, then they see an empty page — no cross-user leakage")
        void given_another_users_notification_when_caller_queries_then_no_leakage_into_their_page() {
            repository.save(NotificationFixtures.basic(BOB));

            String query = "{ notifications(first: 10) { edges { node { id } } } }";
            List<Map<String, Object>> edges = queryExecutor.executeAndExtractJsonPath(
                    query, "data.notifications.edges");

            assertThat(edges).isEmpty();
        }

        @Test
        @DisplayName("Given a freshly saved notification, when querying notifications, then the read flag is false by default")
        void given_fresh_notification_when_querying_then_read_flag_is_false_by_default() {
            repository.save(NotificationFixtures.basic(ALICE));

            String query = "{ notifications(first: 10) { edges { node { read } } } }";
            List<Map<String, Object>> edges = queryExecutor.executeAndExtractJsonPath(
                    query, "data.notifications.edges");

            Map<String, Object> node = (Map<String, Object>) edges.get(0).get("node");
            assertThat(node.get("read")).isEqualTo(false);
        }

        @Test
        @DisplayName("Given a plain Notification with no specialised context subtype, when querying, then context.__typename resolves to GenericContext and payload comes back")
        void given_plain_notification_when_querying_then_context_typename_is_generic_context() {
            repository.save(NotificationFixtures.basic(ALICE));

            String query = "{ notifications(first: 10) { edges { node { context { __typename type ... on GenericContext { payload } } } } } }";
            List<Map<String, Object>> edges = queryExecutor.executeAndExtractJsonPath(
                    query, "data.notifications.edges");

            Map<String, Object> node = (Map<String, Object>) edges.get(0).get("node");
            Map<String, Object> context = (Map<String, Object>) node.get("context");
            assertThat(context.get("__typename")).isEqualTo("GenericContext");
            assertThat(context.get("type")).isEqualTo("welcome");
            assertThat(context.get("payload")).isEqualTo("{}");
        }

        @Test
        @DisplayName("Given a Notification with a contributed context subtype, when querying with an inline fragment on context, then the contributed GraphQL type is selected and subtype fields come back")
        void given_contributed_context_subtype_when_querying_then_routes_to_contributed_type() {
            Notification approval = Notification.builder()
                    .recipientUserId(ALICE)
                    .title("Approval requested")
                    .createdAt(Instant.now())
                    .context(TestApprovalContext.builder()
                            .type(TestApprovalContextTypeResolver.TYPE)
                            .ticketId("ticket-42")
                            .approvalRequestId("apr-7")
                            .build())
                    .build();
            repository.save(approval);

            String query = "{ notifications(first: 10) { edges { node { "
                    + "read context { __typename type "
                    + "... on TestApprovalContext { ticketId approvalRequestId } "
                    + "} } } } }";
            List<Map<String, Object>> edges = queryExecutor.executeAndExtractJsonPath(
                    query, "data.notifications.edges");

            assertThat(edges).hasSize(1);
            Map<String, Object> node = (Map<String, Object>) edges.get(0).get("node");
            Map<String, Object> context = (Map<String, Object>) node.get("context");
            assertThat(context.get("__typename")).isEqualTo("TestApprovalContext");
            assertThat(context.get("type")).isEqualTo(TestApprovalContextTypeResolver.TYPE);
            assertThat(context.get("ticketId")).isEqualTo("ticket-42");
            assertThat(context.get("approvalRequestId")).isEqualTo("apr-7");
        }

        @Test
        @DisplayName("Given a contributed resolver in the chain and a Notification with a plain GenericContext, when querying, then the plain row still falls back to GenericContext — registering a resolver does not regress the fallback")
        void given_contributed_resolver_and_unclaimed_row_when_querying_then_unclaimed_row_falls_back_to_generic() {
            Notification approval = Notification.builder()
                    .recipientUserId(ALICE)
                    .title("Approval requested")
                    .createdAt(Instant.now())
                    .context(TestApprovalContext.builder()
                            .type(TestApprovalContextTypeResolver.TYPE)
                            .ticketId("ticket-1")
                            .build())
                    .build();
            repository.save(approval);
            repository.save(NotificationFixtures.basic(ALICE, "plain-event"));

            String query = "{ notifications(first: 10) { edges { node { context { __typename type } } } } }";
            List<Map<String, Object>> edges = queryExecutor.executeAndExtractJsonPath(
                    query, "data.notifications.edges");

            // _id desc ordering: the plain notification was saved second, so it's first.
            assertThat(edges).hasSize(2);
            Map<String, Object> plainCtx = (Map<String, Object>) ((Map<String, Object>) edges.get(0).get("node")).get("context");
            Map<String, Object> approvalCtx = (Map<String, Object>) ((Map<String, Object>) edges.get(1).get("node")).get("context");
            assertThat(plainCtx.get("__typename")).isEqualTo("GenericContext");
            assertThat(plainCtx.get("type")).isEqualTo("plain-event");
            assertThat(approvalCtx.get("__typename")).isEqualTo("TestApprovalContext");
        }

        @Test
        @DisplayName("Given a base64-decodable but otherwise malformed cursor, when querying, then a GraphQL error is returned instead of silently falling back to the first page")
        void given_malformed_cursor_when_querying_then_graphql_error_is_raised() {
            repository.save(NotificationFixtures.basic(ALICE));
            // Base64-encoded garbage: decodes cleanly but isn't a valid ObjectId.
            String badCursor = CursorCodec.encode("not-an-object-id");

            ExecutionResult result = queryExecutor.execute(String.format(
                    "{ notifications(first: 5, after: \"%s\") { edges { cursor } } }", badCursor));

            assertThat(result.getErrors()).isNotEmpty();
        }

        @Test
        @DisplayName("Given a saved notification with explicit severity and title, when querying both fields, then they come back on the node")
        void given_severity_and_title_when_querying_then_fields_returned() {
            Notification withWarning = Notification.builder()
                    .recipientUserId(ALICE)
                    .severity(NotificationSeverity.WARNING)
                    .title("Heads up")
                    .createdAt(Instant.now())
                    .context(GenericContext.builder().type("welcome").payload("{}").build())
                    .build();
            repository.save(withWarning);

            String query = "{ notifications(first: 10) { edges { node { severity title } } } }";
            List<Map<String, Object>> edges = queryExecutor.executeAndExtractJsonPath(
                    query, "data.notifications.edges");

            Map<String, Object> node = (Map<String, Object>) edges.get(0).get("node");
            assertThat(node.get("severity")).isEqualTo("WARNING");
            assertThat(node.get("title")).isEqualTo("Heads up");
        }

        @Test
        @DisplayName("Given a notification persisted via the fixture (no explicit severity), when querying severity, then it defaults to INFO")
        void given_fixture_without_explicit_severity_when_querying_then_severity_defaults_to_info() {
            repository.save(NotificationFixtures.basic(ALICE));

            String query = "{ notifications(first: 10) { edges { node { severity } } } }";
            List<Map<String, Object>> edges = queryExecutor.executeAndExtractJsonPath(
                    query, "data.notifications.edges");

            Map<String, Object> node = (Map<String, Object>) edges.get(0).get("node");
            assertThat(node.get("severity")).isEqualTo("INFO");
        }

        @Test
        @DisplayName("Given some notifications already marked read in the persistent store, when querying, then the read flag in each edge reflects the per-user state")
        void given_persisted_read_state_when_querying_then_read_flag_reflects_state() {
            Notification first = repository.save(NotificationFixtures.basic(ALICE, "type-1"));
            Notification second = repository.save(NotificationFixtures.basic(ALICE, "type-2"));
            readStateService.markRead(ALICE, second.getId());

            String query = "{ notifications(first: 10) { edges { node { read context { type } } } } }";
            List<Map<String, Object>> edges = queryExecutor.executeAndExtractJsonPath(
                    query, "data.notifications.edges");

            assertThat(edges).hasSize(2);
            // _id desc ordering: most recent first
            Map<String, Object> firstNode = (Map<String, Object>) edges.get(0).get("node");
            Map<String, Object> secondNode = (Map<String, Object>) edges.get(1).get("node");
            assertThat(((Map<String, Object>) firstNode.get("context")).get("type")).isEqualTo("type-2");
            assertThat(firstNode.get("read")).isEqualTo(true);
            assertThat(((Map<String, Object>) secondNode.get("context")).get("type")).isEqualTo("type-1");
            assertThat(secondNode.get("read")).isEqualTo(false);
        }
    }

    @Nested
    @DisplayName("markNotificationAsRead mutation")
    class MarkAsRead {

        @Test
        @DisplayName("Given an unread notification with its Relay-encoded global id, when calling the mutation, then it returns true and the row is persisted")
        void given_unread_notification_when_calling_mutation_with_relay_id_then_returns_true_and_persists() {
            Notification saved = repository.save(NotificationFixtures.basic(ALICE));
            String relayId = RELAY.toGlobalId("Notification", saved.getId());

            String mutation = String.format(
                    "mutation { markNotificationAsRead(notificationId: \"%s\") }", relayId);
            Boolean result = queryExecutor.executeAndExtractJsonPath(
                    mutation, "data.markNotificationAsRead");

            assertThat(result).isTrue();
            // Idempotency on the SPI proves persistence — a second call returns false.
            assertThat(readStateService.markRead(ALICE, saved.getId())).isFalse();
        }

        @Test
        @DisplayName("Given the mutation has already been called once, when calling it again with the same id, then it returns false — idempotent")
        void given_mutation_called_once_when_called_again_with_same_id_then_returns_false() {
            Notification saved = repository.save(NotificationFixtures.basic(ALICE));
            String relayId = RELAY.toGlobalId("Notification", saved.getId());
            String mutation = String.format(
                    "mutation { markNotificationAsRead(notificationId: \"%s\") }", relayId);

            queryExecutor.executeAndExtractJsonPath(mutation, "data.markNotificationAsRead");
            Boolean second = queryExecutor.executeAndExtractJsonPath(
                    mutation, "data.markNotificationAsRead");

            assertThat(second).isFalse();
        }

        @Test
        @DisplayName("Given a raw (non-Relay-encoded) notification id, when calling the mutation, then a GraphQL error is raised — list query also rejects malformed cursors, behaviour is symmetrical")
        void given_raw_notification_id_when_calling_mutation_then_graphql_error() {
            Notification saved = repository.save(NotificationFixtures.basic(ALICE));

            ExecutionResult result = queryExecutor.execute(String.format(
                    "mutation { markNotificationAsRead(notificationId: \"%s\") }", saved.getId()));

            assertThat(result.getErrors()).isNotEmpty();
            assertThat(readStateService.markRead(ALICE, saved.getId())).isTrue();
        }

        @Test
        @DisplayName("Given Alice marks a notification read via the mutation, when Bob marks the same notification, then Bob's first call still returns true — read state is scoped to the JWT principal")
        void given_alice_marks_via_mutation_when_bob_marks_same_then_bobs_first_call_returns_true() {
            Notification saved = repository.save(NotificationFixtures.basic(ALICE));
            String relayId = RELAY.toGlobalId("Notification", saved.getId());

            queryExecutor.executeAndExtractJsonPath(
                    String.format("mutation { markNotificationAsRead(notificationId: \"%s\") }", relayId),
                    "data.markNotificationAsRead");

            // Alice marked it — second call from her returns false (already read).
            assertThat(readStateService.markRead(ALICE, saved.getId())).isFalse();
            // Bob never read it — first call from him returns true.
            assertThat(readStateService.markRead(BOB, saved.getId())).isTrue();
        }

        @Test
        @DisplayName("Given a Relay-encoded id that points at a different type (e.g. Device), when calling the mutation, then a GraphQL error is raised")
        void given_relay_id_for_wrong_type_when_calling_mutation_then_graphql_error() {
            String wrongTypeId = RELAY.toGlobalId("Device", "abc-123");

            ExecutionResult result = queryExecutor.execute(String.format(
                    "mutation { markNotificationAsRead(notificationId: \"%s\") }", wrongTypeId));

            assertThat(result.getErrors()).isNotEmpty();
        }
    }

    @Nested
    @DisplayName("machineNotifications query")
    class MachineNotificationsQuery {

        private static final String MACHINE_ID = "machine-007";

        @Test
        @DisplayName("Given an AGENT principal, when querying machineNotifications, then it returns rows targeted at that machine plus broadcasts")
        void given_agent_principal_when_querying_then_returns_machine_rows_and_broadcasts() {
            authAsAgent(MACHINE_ID);

            Notification machineRow = repository.save(Notification.builder()
                    .recipientScope(RecipientScope.MACHINE)
                    .recipientMachineId(MACHINE_ID)
                    .title("Direct event")
                    .createdAt(Instant.now())
                    .context(GenericContext.builder().type("event").payload("{}").build())
                    .build());
            Notification broadcast = repository.save(Notification.builder()
                    .recipientScope(RecipientScope.ALL)
                    .title("Tenant-wide event")
                    .createdAt(Instant.now())
                    .context(GenericContext.builder().type("ann").payload("{}").build())
                    .build());

            String query = "{ machineNotifications(first: 10) { edges { node { id } } } }";
            List<Map<String, Object>> edges = queryExecutor.executeAndExtractJsonPath(
                    query, "data.machineNotifications.edges");

            assertThat(extractIds(edges)).containsExactlyInAnyOrder(
                    RELAY.toGlobalId("Notification", machineRow.getId()),
                    RELAY.toGlobalId("Notification", broadcast.getId()));
        }

        @Test
        @DisplayName("Given the caller's own machine rows alongside another machine's rows, when querying machineNotifications, then only the caller's rows come back — no cross-machine leakage")
        void given_own_and_other_machines_rows_when_querying_then_only_own_visible() {
            authAsAgent(MACHINE_ID);

            Notification own1 = saveMachineRow(MACHINE_ID, "own-1");
            Notification own2 = saveMachineRow(MACHINE_ID, "own-2");
            Notification foreign = saveMachineRow("other-machine", "foreign");

            String query = "{ machineNotifications(first: 10) { edges { node { id } } } }";
            List<Map<String, Object>> edges = queryExecutor.executeAndExtractJsonPath(
                    query, "data.machineNotifications.edges");

            List<String> ids = extractIds(edges);
            assertThat(ids).containsExactlyInAnyOrder(
                    RELAY.toGlobalId("Notification", own1.getId()),
                    RELAY.toGlobalId("Notification", own2.getId()));
            assertThat(ids).doesNotContain(RELAY.toGlobalId("Notification", foreign.getId()));
        }

        @Test
        @DisplayName("Given an AGENT principal and a saved machine notification, when querying, then the node id is a Relay-encoded global id pointing back at the raw row id")
        void given_machine_notification_when_querying_then_node_id_is_relay_encoded() {
            authAsAgent(MACHINE_ID);
            Notification saved = saveMachineRow(MACHINE_ID, "event");

            String query = "{ machineNotifications(first: 10) { edges { node { id } } } }";
            List<Map<String, Object>> edges = queryExecutor.executeAndExtractJsonPath(
                    query, "data.machineNotifications.edges");

            String relayId = (String) ((Map<String, Object>) edges.get(0).get("node")).get("id");
            Relay.ResolvedGlobalId resolved = RELAY.fromGlobalId(relayId);
            assertThat(resolved.getType()).isEqualTo("Notification");
            assertThat(resolved.getId()).isEqualTo(saved.getId());
        }

        @Test
        @DisplayName("Given a machine notification with a plain GenericContext, when querying, then context.__typename resolves to GenericContext and severity/title come back")
        void given_machine_notification_with_generic_context_when_querying_then_context_typename_and_shared_fields_returned() {
            authAsAgent(MACHINE_ID);
            repository.save(Notification.builder()
                    .recipientScope(RecipientScope.MACHINE)
                    .recipientMachineId(MACHINE_ID)
                    .severity(NotificationSeverity.WARNING)
                    .title("Heads up")
                    .createdAt(Instant.now())
                    .context(GenericContext.builder().type("event").payload("{\"k\":\"v\"}").build())
                    .build());

            String query = "{ machineNotifications(first: 10) { edges { node { "
                    + "severity title context { __typename type ... on GenericContext { payload } } "
                    + "} } } }";
            List<Map<String, Object>> edges = queryExecutor.executeAndExtractJsonPath(
                    query, "data.machineNotifications.edges");

            Map<String, Object> node = (Map<String, Object>) edges.get(0).get("node");
            Map<String, Object> context = (Map<String, Object>) node.get("context");
            assertThat(node.get("severity")).isEqualTo("WARNING");
            assertThat(node.get("title")).isEqualTo("Heads up");
            assertThat(context.get("__typename")).isEqualTo("GenericContext");
            assertThat(context.get("type")).isEqualTo("event");
            assertThat(context.get("payload")).isEqualTo("{\"k\":\"v\"}");
        }

        @Test
        @DisplayName("Given a base64-decodable but malformed cursor, when querying machineNotifications, then a GraphQL error is raised — same strict cursor handling as the user-side query")
        void given_malformed_cursor_when_querying_machine_notifications_then_graphql_error() {
            authAsAgent(MACHINE_ID);
            saveMachineRow(MACHINE_ID, "event");
            String badCursor = CursorCodec.encode("not-an-object-id");

            ExecutionResult result = queryExecutor.execute(String.format(
                    "{ machineNotifications(first: 5, after: \"%s\") { edges { cursor } } }", badCursor));

            assertThat(result.getErrors()).isNotEmpty();
        }

        private Notification saveMachineRow(String machineId, String typeToken) {
            return repository.save(Notification.builder()
                    .recipientScope(RecipientScope.MACHINE)
                    .recipientMachineId(machineId)
                    .title(typeToken)
                    .createdAt(Instant.now())
                    .context(GenericContext.builder().type(typeToken).payload("{}").build())
                    .build());
        }

        @Test
        @DisplayName("Given multiple machine notifications, when paginating forward, then consecutive pages are disjoint")
        void given_multiple_machine_notifications_when_paginating_then_pages_disjoint() {
            authAsAgent(MACHINE_ID);
            for (int i = 0; i < 5; i++) {
                repository.save(Notification.builder()
                        .recipientScope(RecipientScope.MACHINE)
                        .recipientMachineId(MACHINE_ID)
                        .title("Event " + i)
                        .createdAt(Instant.now())
                        .context(GenericContext.builder().type("type-" + i).payload("{}").build())
                        .build());
                try { Thread.sleep(2); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            }

            Map<String, Object> first = queryExecutor.executeAndExtractJsonPath(
                    "{ machineNotifications(first: 2) { edges { node { id } } pageInfo { hasNextPage endCursor } } }",
                    "data.machineNotifications");
            String afterCursor = (String) ((Map<String, Object>) first.get("pageInfo")).get("endCursor");

            Map<String, Object> second = queryExecutor.executeAndExtractJsonPath(
                    String.format("{ machineNotifications(first: 2, after: \"%s\") { edges { node { id } } } }", afterCursor),
                    "data.machineNotifications");

            List<Map<String, Object>> firstEdges = (List<Map<String, Object>>) first.get("edges");
            List<Map<String, Object>> secondEdges = (List<Map<String, Object>>) second.get("edges");
            assertThat(extractIds(firstEdges)).doesNotContainAnyElementsOf(extractIds(secondEdges));
        }
    }

    @Nested
    @DisplayName("authentication boundary")
    class AuthBoundary {

        @Test
        @DisplayName("Given no authenticated user in the security context, when querying notifications-related endpoints, then a GraphQL error mentioning Unauthorized is surfaced")
        void given_no_authentication_when_querying_then_unauthorized_graphql_error() {
            SecurityContextHolder.clearContext();

            ExecutionResult result = queryExecutor.execute("{ hasUnreadNotifications }");

            assertThat(result.getErrors()).isNotEmpty();
            assertThat(result.getErrors().getFirst().getMessage())
                    .containsAnyOf("Unauthorized", UnauthorizedException.class.getSimpleName());
        }

        @Test
        @DisplayName("Given an ADMIN principal, when querying machineNotifications, then a GraphQL error is raised — only AGENT principals can read a machine's backlog")
        void given_admin_principal_when_querying_machine_notifications_then_unauthorized() {
            // BeforeEach authenticated us as Alice (ADMIN by default).
            ExecutionResult result = queryExecutor.execute(
                    "{ machineNotifications(first: 10) { edges { node { id } } } }");

            assertThat(result.getErrors()).isNotEmpty();
            assertThat(result.getErrors().getFirst().getMessage())
                    .containsAnyOf("AGENT", "Unauthorized", UnauthorizedException.class.getSimpleName());
        }

        @Test
        @DisplayName("Given an AGENT principal whose JWT is missing the machine_id claim, when querying machineNotifications, then a GraphQL error is raised")
        void given_agent_without_machine_id_claim_when_querying_machine_notifications_then_unauthorized() {
            authAsAgentWithoutMachineId();

            ExecutionResult result = queryExecutor.execute(
                    "{ machineNotifications(first: 10) { edges { node { id } } } }");

            assertThat(result.getErrors()).isNotEmpty();
            assertThat(result.getErrors().getFirst().getMessage())
                    .containsAnyOf("machine_id", "Unauthorized", UnauthorizedException.class.getSimpleName());
        }
    }

    private static List<String> extractIds(List<Map<String, Object>> edges) {
        return edges.stream()
                .map(e -> (Map<String, Object>) e.get("node"))
                .map(n -> (String) n.get("id"))
                .toList();
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

    private static void authAs(String userId) {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .subject(userId)
                .claim("userId", userId)
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }

    private static void authAsAgent(String machineId) {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .subject("agent-" + machineId)
                .claim("userId", "agent-" + machineId)
                .claim("machine_id", machineId)
                .claim("roles", List.of("AGENT"))
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }

    private static void authAsAgentWithoutMachineId() {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .subject("agent-broken")
                .claim("userId", "agent-broken")
                .claim("roles", List.of("AGENT"))
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }
}
