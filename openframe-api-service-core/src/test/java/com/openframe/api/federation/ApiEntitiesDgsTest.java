package com.openframe.api.federation;

import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.netflix.graphql.dgs.springgraphql.autoconfig.DgsSpringGraphQLAutoConfiguration;
import com.openframe.api.dto.user.UserResponse;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.graphql.autoconfigure.GraphQlAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@SpringBootTest(
        classes = ApiEntitiesDgsTest.EntitiesApp.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "dgs.graphql.schema-locations=classpath:test-schema/federated-entities.graphqls")
@MockitoBean(types = {OrganizationService.class, ToolService.class, TagService.class, ToolConnectionService.class,
        InstalledAgentService.class, ScriptService.class, ScriptExecutionService.class, ScheduleScriptService.class,
        ScheduleRunService.class})
class ApiEntitiesDgsTest {

    private static final String USER_ID = "665f1c2ab3e4d5f6a7b8c9a1";
    private static final String MACHINE_ID = "machine-1";
    private static final String TYPENAME = "__typename";
    private static final String REPRESENTATIONS = "representations";
    private static final String ENTITIES_QUERY = """
            query($representations: [_Any!]!) {
              _entities(representations: $representations) {
                ... on User { id firstName }
                ... on Machine { machineId hostname }
              }
            }
            """;

    @MockitoBean private UserService userService;
    @MockitoBean private DeviceService deviceService;

    @Autowired private DgsQueryExecutor queryExecutor;

    private final RelayIdCodec codec = new RelayIdCodec();

    private UserResponse user;
    private Machine machine;

    @BeforeEach
    void setUp() {
        user = UserResponse.builder().id(USER_ID).firstName("Ada").build();
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setHostname("host-1");
    }

    @Test
    void entities_userIdAndMachineIdKeys_resolvedByTheirLoaders() {
        // setup
        when(userService.getUsersByIds(List.of(USER_ID))).thenReturn(List.of(user));
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        Map<String, Object> userKey = Map.of(TYPENAME, "User", "id", USER_ID);
        Map<String, Object> machineKey = Map.of(TYPENAME, "Machine", "machineId", MACHINE_ID);
        Map<String, Object> variables = Map.of(REPRESENTATIONS, List.of(userKey, machineKey));

        // execution
        ExecutionResult result = queryExecutor.execute(ENTITIES_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData()).containsEntry("_entities", List.of(
                Map.of("id", USER_ID, "firstName", "Ada"),
                Map.of("machineId", MACHINE_ID, "hostname", "host-1")));
    }

    @Test
    void entities_userGlobalIdKey_resolvedByTheRawUserId() {
        // setup
        when(userService.getUsersByIds(List.of(USER_ID))).thenReturn(List.of(user));
        String userGlobalId = codec.encode(NodeType.USER, USER_ID);
        Map<String, Object> userKey = Map.of(TYPENAME, "User", "id", userGlobalId);
        Map<String, Object> variables = Map.of(REPRESENTATIONS, List.of(userKey));

        // execution
        ExecutionResult result = queryExecutor.execute(ENTITIES_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData())
                .containsEntry("_entities", List.of(Map.of("id", USER_ID, "firstName", "Ada")));
    }

    @Test
    void entities_unknownMachineId_nullWithoutError() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());
        Map<String, Object> machineKey = Map.of(TYPENAME, "Machine", "machineId", MACHINE_ID);
        Map<String, Object> variables = Map.of(REPRESENTATIONS, List.of(machineKey));
        List<Object> expected = Collections.singletonList(null);

        // execution
        ExecutionResult result = queryExecutor.execute(ENTITIES_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData()).containsEntry("_entities", expected);
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({GraphQlAutoConfiguration.class, DgsSpringGraphQLAutoConfiguration.class,
            RelayAutoConfiguration.class, NodeAutoConfiguration.class})
    @Import(ApiNodeLoaderConfiguration.class)
    static class EntitiesApp {
    }
}
