package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.netflix.graphql.dgs.springgraphql.autoconfig.DgsSpringGraphQLAutoConfiguration;
import com.openframe.api.config.DgsAuthPrincipalArgumentResolver;
import com.openframe.api.relay.ApiNodeLoaderConfiguration;
import com.openframe.api.service.InstalledAgentService;
import com.openframe.api.service.TagService;
import com.openframe.api.service.ToolConnectionService;
import com.openframe.api.service.ToolService;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.schedule.ScheduleRunService;
import com.openframe.api.service.rmm.schedule.ScheduleScriptService;
import com.openframe.api.service.rmm.script.ScriptExecutionService;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.api.service.user.UserService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.service.OrganizationService;
import com.openframe.graphql.node.NodeAutoConfiguration;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayAutoConfiguration;
import com.openframe.graphql.relay.RelayIdCodec;
import graphql.ExecutionResult;
import graphql.GraphQLError;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.graphql.autoconfigure.GraphQlAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.InstanceOfAssertFactories.STRING;
import static org.mockito.Mockito.when;

@SpringBootTest(
        classes = NodeDataFetcherDgsTest.NodeApp.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "dgs.graphql.schema-locations=classpath:test-schema/api-nodes.graphqls")
@MockitoBean(types = {OrganizationService.class, ToolService.class, TagService.class, ToolConnectionService.class,
        InstalledAgentService.class, ScriptService.class, ScriptExecutionService.class, ScheduleScriptService.class,
        ScheduleRunService.class, UserService.class})
class NodeDataFetcherDgsTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String DIALOG_ID = "665f1c2ab3e4d5f6a7b8c9e1";
    private static final String RAW_OBJECT_ID = "507f1f77bcf86cd799439011";
    private static final String HOSTNAME = "host-1";
    private static final String TYPENAME = "__typename";
    private static final String NODE_QUERY = "query($id: ID!) { node(id: $id) { __typename id ... on Machine { hostname } } }";
    private static final String NODES_QUERY = "query($ids: [ID!]!) { nodes(ids: $ids) { __typename id } }";

    @MockitoBean private DeviceService deviceService;

    @Autowired private DgsQueryExecutor queryExecutor;

    private final RelayIdCodec codec = new RelayIdCodec();

    private Machine machine;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setHostname(HOSTNAME);
    }

    @Test
    void node_machineGlobalId_answersTheMachine() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        String machineGlobalId = codec.encode(NodeType.MACHINE, MACHINE_ID);
        Map<String, Object> variables = Map.of("id", machineGlobalId);

        // execution
        ExecutionResult result = queryExecutor.execute(NODE_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData())
                .containsEntry("node", Map.of(TYPENAME, "Machine", "id", machineGlobalId, "hostname", HOSTNAME));
    }

    @Test
    void node_aiAgentStubGlobalId_answersAReference() {
        // setup
        String dialogGlobalId = codec.encode(NodeType.DIALOG, DIALOG_ID);
        Map<String, Object> variables = Map.of("id", dialogGlobalId);

        // execution
        ExecutionResult result = queryExecutor.execute(NODE_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData())
                .containsEntry("node", Map.of(TYPENAME, "Dialog", "id", dialogGlobalId));
    }

    @Test
    void node_rawId_answersInvalidNodeIdError() {
        // setup
        Map<String, Object> variables = Map.of("id", RAW_OBJECT_ID);

        // execution
        ExecutionResult result = queryExecutor.execute(NODE_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).singleElement()
                .extracting(GraphQLError::getMessage, as(STRING))
                .contains("Invalid node id");
    }

    @Test
    void nodes_machineAndRawIds_answersTheMachineAndANullSlot() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        String machineGlobalId = codec.encode(NodeType.MACHINE, MACHINE_ID);
        Map<String, Object> variables = Map.of("ids", List.of(machineGlobalId, RAW_OBJECT_ID));
        List<Object> expected = Arrays.asList(Map.of(TYPENAME, "Machine", "id", machineGlobalId), null);

        // execution
        ExecutionResult result = queryExecutor.execute(NODES_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData()).containsEntry("nodes", expected);
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({GraphQlAutoConfiguration.class, DgsSpringGraphQLAutoConfiguration.class,
            RelayAutoConfiguration.class, NodeAutoConfiguration.class})
    @Import({NodeDataFetcher.class, ApiNodeLoaderConfiguration.class, DgsAuthPrincipalArgumentResolver.class})
    static class NodeApp {
    }
}
