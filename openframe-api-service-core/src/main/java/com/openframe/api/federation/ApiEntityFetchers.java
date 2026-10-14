package com.openframe.api.federation;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsEntityFetcher;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.user.UserService;
import com.openframe.data.document.device.Machine;
import com.openframe.graphql.relay.InvalidRelayIdException;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.springframework.util.StringUtils.hasText;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class ApiEntityFetchers {

    private static final String ID = "id";
    private static final String MACHINE_ID = "machineId";

    private final UserService userService;
    private final DeviceService deviceService;
    private final RelayIdCodec relayIdCodec;

    @DgsEntityFetcher(name = "User")
    public UserResponse user(Map<String, Object> values) {
        String id = (String) values.get(ID);
        return decodeUserId(id)
                .flatMap(this::findUser)
                .orElse(null);
    }

    @DgsEntityFetcher(name = "Machine")
    public Machine machine(Map<String, Object> values) {
        String machineId = (String) values.get(MACHINE_ID);
        if (!hasText(machineId)) {
            return null;
        }
        return deviceService.findByMachineId(machineId).orElse(null);
    }

    private Optional<String> decodeUserId(String id) {
        try {
            String rawId = relayIdCodec.decode(id, NodeType.USER);
            return Optional.ofNullable(rawId);
        } catch (InvalidRelayIdException e) {
            log.debug("User entity key {} is not a User id: {}", id, e.getMessage());
            return Optional.empty();
        }
    }

    private Optional<UserResponse> findUser(String rawId) {
        List<String> ids = List.of(rawId);
        List<UserResponse> users = userService.getUsersByIds(ids);
        return users.stream().findFirst();
    }
}
