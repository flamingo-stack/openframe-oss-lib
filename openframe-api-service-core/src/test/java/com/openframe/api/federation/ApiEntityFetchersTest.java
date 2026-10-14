package com.openframe.api.federation;

import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.user.UserService;
import com.openframe.data.document.device.Machine;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApiEntityFetchersTest {

    private static final String USER_ID = "665f1c2ab3e4d5f6a7b8c9a1";
    private static final String MACHINE_ID = "machine-1";

    @Mock private UserService userService;
    @Mock private DeviceService deviceService;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @InjectMocks private ApiEntityFetchers fetchers;

    private final RelayIdCodec codec = new RelayIdCodec();
    private UserResponse user;
    private Machine machine;

    @BeforeEach
    void setUp() {
        user = UserResponse.builder().id(USER_ID).build();
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
    }

    @Test
    void user_encodedId_resolvedByRawId() {
        // setup
        when(userService.getUsersByIds(List.of(USER_ID))).thenReturn(List.of(user));
        String userGlobalId = codec.encode(NodeType.USER, USER_ID);
        Map<String, Object> key = Map.of("id", userGlobalId);

        // execution
        UserResponse entity = fetchers.user(key);

        // verifications
        assertThat(entity).isSameAs(user);
    }

    @Test
    void user_rawId_resolvedAsIs() {
        // setup
        when(userService.getUsersByIds(List.of(USER_ID))).thenReturn(List.of(user));
        Map<String, Object> key = Map.of("id", USER_ID);

        // execution
        UserResponse entity = fetchers.user(key);

        // verifications
        assertThat(entity).isSameAs(user);
    }

    @Test
    void user_otherTypesGlobalId_nullWithoutLookup() {
        // setup
        String machineGlobalId = codec.encode(NodeType.MACHINE, MACHINE_ID);
        Map<String, Object> key = Map.of("id", machineGlobalId);

        // execution
        UserResponse entity = fetchers.user(key);

        // verifications
        assertThat(entity).isNull();
        verifyNoInteractions(userService);
    }

    @Test
    void user_unknownUser_null() {
        // setup
        when(userService.getUsersByIds(List.of(USER_ID))).thenReturn(List.of());
        Map<String, Object> key = Map.of("id", USER_ID);

        // execution
        UserResponse entity = fetchers.user(key);

        // verifications
        assertThat(entity).isNull();
    }

    @Test
    void machine_knownMachineId_resolved() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        Map<String, Object> key = Map.of("machineId", MACHINE_ID);

        // execution
        Machine entity = fetchers.machine(key);

        // verifications
        assertThat(entity).isSameAs(machine);
    }

    @Test
    void machine_unknownMachineId_null() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());
        Map<String, Object> key = Map.of("machineId", MACHINE_ID);

        // execution
        Machine entity = fetchers.machine(key);

        // verifications
        assertThat(entity).isNull();
    }
}
