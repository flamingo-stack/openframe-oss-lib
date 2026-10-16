package com.openframe.graphql.node;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.netflix.graphql.dgs.InputArgument;
import com.netflix.graphql.dgs.springgraphql.autoconfig.DgsSpringGraphQLAutoConfiguration;
import com.netflix.graphql.types.errors.ErrorType;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayAutoConfiguration;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.ExecutionResult;
import graphql.GraphQLError;
import graphql.execution.DataFetcherExceptionHandler;
import graphql.execution.DataFetcherExceptionHandlerParameters;
import graphql.schema.DataFetchingEnvironment;
import graphql.schema.GraphQLSchema;
import lombok.RequiredArgsConstructor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.graphql.autoconfigure.GraphQlAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.assertj.core.api.InstanceOfAssertFactories.STRING;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@SpringBootTest(
        classes = NodeFederationDgsTest.NodeGraphQlApp.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "dgs.graphql.schema-locations=classpath:test-schema/node-federation.graphqls")
class NodeFederationDgsTest {

    private static final AuthPrincipal CALLER = AuthPrincipal.builder().id("user-1").build();
    private static final String TICKET_ID = "665f1c2ab3e4d5f6a7b8c9d0";
    private static final String POLICY_ID = "665f1c2ab3e4d5f6a7b8c9f2";
    private static final String DIALOG_ID = "665f1c2ab3e4d5f6a7b8c9e1";
    private static final String USER_ID = "665f1c2ab3e4d5f6a7b8c9a1";
    private static final String TICKET_TITLE = "Printer jam";
    private static final String POLICY_NAME = "Strict";
    // base64url("Foo:1"): a well-formed global id whose type is not a NodeType
    private static final String UNKNOWN_TYPE_GLOBAL_ID = "Rm9vOjE";
    private static final String TYPENAME = "__typename";
    private static final String REPRESENTATIONS = "representations";
    private static final String NODE_QUERY = "query($id: ID!) { node(id: $id) { __typename id ... on Ticket { title } } }";
    private static final String NODES_QUERY = "query($ids: [ID!]!) { nodes(ids: $ids) { __typename id } }";
    private static final String ENTITIES_QUERY = """
            query($representations: [_Any!]!) {
              _entities(representations: $representations) {
                ... on Ticket { title }
                ... on GuardrailPolicy { name }
              }
            }
            """;

    @MockitoBean private NodeLookups lookups;
    @MockitoBean private EntityCallerAuthorizer callerAuthorizer;
    @MockitoSpyBean private DataFetcherExceptionHandler exceptionHandler;

    @Autowired private DgsQueryExecutor queryExecutor;

    private final RelayIdCodec codec = new RelayIdCodec();

    private SupportTicket ticket;
    private Policy policy;

    @BeforeEach
    void setUp() {
        ticket = new SupportTicket(TICKET_ID, TICKET_TITLE);
        policy = new Policy(POLICY_ID, POLICY_NAME);
    }

    @Test
    void node_typeWithLoader_answersTheNodeUnderItsGraphqlType() {
        // setup
        when(lookups.findTicket(CALLER, TICKET_ID)).thenReturn(Optional.of(ticket));
        String ticketGlobalId = codec.encode(NodeType.TICKET, TICKET_ID);
        Map<String, Object> variables = Map.of("id", ticketGlobalId);

        // execution
        ExecutionResult result = queryExecutor.execute(NODE_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData())
                .containsEntry("node", Map.of(TYPENAME, "Ticket", "id", ticketGlobalId, "title", TICKET_TITLE));
    }

    @Test
    void node_referenceStub_answersAReferenceWithoutLookup() {
        // setup
        String dialogGlobalId = codec.encode(NodeType.DIALOG, DIALOG_ID);
        Map<String, Object> variables = Map.of("id", dialogGlobalId);

        // execution
        ExecutionResult result = queryExecutor.execute(NODE_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData())
                .containsEntry("node", Map.of(TYPENAME, "Dialog", "id", dialogGlobalId));
        verifyNoInteractions(lookups);
    }

    @Test
    void node_entityWithLocalFieldsAndNoLoader_answersUnsupportedNodeType() {
        // setup
        String userGlobalId = codec.encode(NodeType.USER, USER_ID);
        Map<String, Object> variables = Map.of("id", userGlobalId);

        // execution
        ExecutionResult result = queryExecutor.execute(NODE_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).singleElement()
                .extracting(GraphQLError::getMessage, as(STRING))
                .contains("Unsupported node type: User");
    }

    @Test
    void node_typeOutsideNodeType_answersUnknownNodeType() {
        // setup
        Map<String, Object> variables = Map.of("id", UNKNOWN_TYPE_GLOBAL_ID);

        // execution
        ExecutionResult result = queryExecutor.execute(NODE_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).singleElement()
                .extracting(GraphQLError::getMessage, as(STRING))
                .contains("Unknown Node type: Foo");
    }

    @Test
    void nodes_unresolvableIds_answersNullSlots() {
        // setup
        when(lookups.findTicket(CALLER, TICKET_ID)).thenReturn(Optional.of(ticket));
        String ticketGlobalId = codec.encode(NodeType.TICKET, TICKET_ID);
        String userGlobalId = codec.encode(NodeType.USER, USER_ID);
        List<String> ids = List.of(ticketGlobalId, userGlobalId, UNKNOWN_TYPE_GLOBAL_ID, "garbage");
        Map<String, Object> variables = Map.of("ids", ids);
        List<Object> expected = Arrays.asList(Map.of(TYPENAME, "Ticket", "id", ticketGlobalId), null, null, null);

        // execution
        ExecutionResult result = queryExecutor.execute(NODES_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData()).containsEntry("nodes", expected);
    }

    @Test
    void entities_rawAndEncodedKeys_resolvedThroughTheirLoaders() {
        // setup
        when(callerAuthorizer.authorizeCaller()).thenReturn(CALLER);
        when(lookups.findTicket(CALLER, TICKET_ID)).thenReturn(Optional.of(ticket));
        when(lookups.findPolicy(POLICY_ID)).thenReturn(Optional.of(policy));
        String policyGlobalId = codec.encode(NodeType.GUARDRAIL_POLICY, POLICY_ID);
        Map<String, Object> ticketKey = Map.of(TYPENAME, "Ticket", "id", TICKET_ID);
        Map<String, Object> policyKey = Map.of(TYPENAME, "GuardrailPolicy", "id", policyGlobalId);
        Map<String, Object> variables = Map.of(REPRESENTATIONS, List.of(ticketKey, policyKey));

        // execution
        ExecutionResult result = queryExecutor.execute(ENTITIES_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData())
                .containsEntry("_entities", List.of(Map.of("title", TICKET_TITLE), Map.of("name", POLICY_NAME)));
        verify(callerAuthorizer).authorizeCaller();
    }

    @Test
    void entities_foreignTypedKey_nullWithoutLookup() {
        // setup
        when(callerAuthorizer.authorizeCaller()).thenReturn(CALLER);
        String dialogGlobalId = codec.encode(NodeType.DIALOG, DIALOG_ID);
        Map<String, Object> ticketKey = Map.of(TYPENAME, "Ticket", "id", dialogGlobalId);
        Map<String, Object> variables = Map.of(REPRESENTATIONS, List.of(ticketKey));
        List<Object> expected = Collections.singletonList(null);

        // execution
        ExecutionResult result = queryExecutor.execute(ENTITIES_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData()).containsEntry("_entities", expected);
        verifyNoInteractions(lookups);
    }

    @Test
    void entities_typeWithoutLoader_badRequestOnlyAtItsIndex() {
        // setup
        when(callerAuthorizer.authorizeCaller()).thenReturn(CALLER);
        when(lookups.findTicket(CALLER, TICKET_ID)).thenReturn(Optional.of(ticket));
        Map<String, Object> ticketKey = Map.of(TYPENAME, "Ticket", "id", TICKET_ID);
        Map<String, Object> dialogKey = Map.of(TYPENAME, "Dialog", "id", DIALOG_ID);
        Map<String, Object> variables = Map.of(REPRESENTATIONS, List.of(ticketKey, dialogKey));
        List<Object> expected = Arrays.asList(Map.of("title", TICKET_TITLE), null);

        // execution
        ExecutionResult result = queryExecutor.execute(ENTITIES_QUERY, variables);

        // verifications
        assertThat(result.<Map<String, Object>>getData()).containsEntry("_entities", expected);
        assertThat(result.getErrors())
                .extracting(GraphQLError::getPath, GraphQLError::getErrorType, GraphQLError::getMessage)
                .containsExactly(tuple(List.of("_entities", 1), ErrorType.BAD_REQUEST, "No node loader for type Dialog"));
        verify(callerAuthorizer).authorizeCaller();
        verifyNoInteractions(exceptionHandler);
    }

    @Test
    void entities_noTypename_badRequestAtItsIndex() {
        // setup
        when(callerAuthorizer.authorizeCaller()).thenReturn(CALLER);
        Map<String, Object> keyWithoutTypename = Map.of("id", TICKET_ID);
        Map<String, Object> variables = Map.of(REPRESENTATIONS, List.of(keyWithoutTypename));
        List<Object> expected = Collections.singletonList(null);

        // execution
        ExecutionResult result = queryExecutor.execute(ENTITIES_QUERY, variables);

        // verifications
        assertThat(result.<Map<String, Object>>getData()).containsEntry("_entities", expected);
        assertThat(result.getErrors())
                .extracting(GraphQLError::getPath, GraphQLError::getErrorType, GraphQLError::getMessage)
                .containsExactly(tuple(List.of("_entities", 0), ErrorType.BAD_REQUEST, "Representation has no __typename"));
        verifyNoInteractions(exceptionHandler, lookups);
    }

    @Test
    void entities_callerRefused_everyIndexFailsWithoutLookup() {
        // setup
        when(callerAuthorizer.authorizeCaller()).thenThrow(new AccessDeniedException("Access Denied"));
        Map<String, Object> ticketKey = Map.of(TYPENAME, "Ticket", "id", TICKET_ID);
        Map<String, Object> policyKey = Map.of(TYPENAME, "GuardrailPolicy", "id", POLICY_ID);
        Map<String, Object> variables = Map.of(REPRESENTATIONS, List.of(ticketKey, policyKey));
        List<Object> expected = Arrays.asList(null, null);

        // execution
        ExecutionResult result = queryExecutor.execute(ENTITIES_QUERY, variables);

        // verifications
        assertThat(result.<Map<String, Object>>getData()).containsEntry("_entities", expected);
        assertThat(result.getErrors())
                .extracting(GraphQLError::getPath)
                .containsExactly(List.of("_entities", 0), List.of("_entities", 1));
        verify(callerAuthorizer).authorizeCaller();
        verifyNoInteractions(lookups);
        verify(exceptionHandler, times(2)).handleException(any(DataFetcherExceptionHandlerParameters.class));
    }

    interface NodeLookups {

        Optional<SupportTicket> findTicket(AuthPrincipal principal, String rawId);

        Optional<Policy> findPolicy(String rawId);
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({GraphQlAutoConfiguration.class, DgsSpringGraphQLAutoConfiguration.class,
            RelayAutoConfiguration.class, NodeAutoConfiguration.class})
    @Import(NodeQueries.class)
    static class NodeGraphQlApp {

        @Bean
        NodeLoader<SupportTicket> ticketLoader(NodeLookups lookups) {
            return LookupNodeLoader.byPrincipalAndRawId(NodeType.TICKET, SupportTicket.class, lookups::findTicket);
        }

        @Bean
        NodeLoader<Policy> policyLoader(NodeLookups lookups) {
            return LookupNodeLoader.byRawId(NodeType.GUARDRAIL_POLICY, Policy.class, lookups::findPolicy);
        }
    }

    @DgsComponent
    @RequiredArgsConstructor
    static class NodeQueries {

        private final RelayNodeFinder nodeFinder;

        @DgsQuery
        Object node(@InputArgument String id, DataFetchingEnvironment environment) {
            GraphQLSchema schema = environment.getGraphQLSchema();
            Optional<Object> node = nodeFinder.findNode(CALLER, id, schema);
            return node.orElse(null);
        }

        @DgsQuery
        List<Object> nodes(@InputArgument List<String> ids, DataFetchingEnvironment environment) {
            GraphQLSchema schema = environment.getGraphQLSchema();
            return ids.stream()
                    .map(id -> findNodeOrNull(id, schema))
                    .toList();
        }

        private Object findNodeOrNull(String id, GraphQLSchema schema) {
            Optional<Object> node = nodeFinder.findNodeIfResolvable(CALLER, id, schema);
            return node.orElse(null);
        }
    }
}
