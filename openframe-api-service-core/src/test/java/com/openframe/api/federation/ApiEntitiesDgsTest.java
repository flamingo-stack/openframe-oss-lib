package com.openframe.api.federation;

import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.netflix.graphql.dgs.springgraphql.autoconfig.DgsSpringGraphQLAutoConfiguration;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.user.UserService;
import com.openframe.data.document.device.Machine;
import com.openframe.graphql.relay.RelayIdCodec;
import graphql.ExecutionResult;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.graphql.autoconfigure.GraphQlAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@SpringBootTest(
        classes = ApiEntitiesDgsTest.EntitiesApp.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "dgs.graphql.schema-locations=classpath:test-schema/federated-entities.graphqls")
class ApiEntitiesDgsTest {

    private static final String USER_ID = "665f1c2ab3e4d5f6a7b8c9a1";
    private static final String MACHINE_ID = "machine-1";
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

    @Test
    void entities_userAndMachineKeys_resolvedByTheirFetchers() {
        // setup
        UserResponse user = UserResponse.builder().id(USER_ID).firstName("Ada").build();
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setHostname("host-1");
        when(userService.getUsersByIds(List.of(USER_ID))).thenReturn(List.of(user));
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        Map<String, Object> userKey = Map.of("__typename", "User", "id", USER_ID);
        Map<String, Object> machineKey = Map.of("__typename", "Machine", "machineId", MACHINE_ID);
        Map<String, Object> variables = Map.of("representations", List.of(userKey, machineKey));

        // execution
        ExecutionResult result = queryExecutor.execute(ENTITIES_QUERY, variables);

        // verifications
        assertThat(result.getErrors()).isEmpty();
        Map<String, Object> data = result.getData();
        assertThat(data).containsEntry("_entities", List.of(
                Map.of("id", USER_ID, "firstName", "Ada"),
                Map.of("machineId", MACHINE_ID, "hostname", "host-1")));
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({GraphQlAutoConfiguration.class, DgsSpringGraphQLAutoConfiguration.class})
    @Import({ApiEntityFetchers.class, ApiFederationResolver.class, RelayIdCodec.class})
    static class EntitiesApp {
    }
}
