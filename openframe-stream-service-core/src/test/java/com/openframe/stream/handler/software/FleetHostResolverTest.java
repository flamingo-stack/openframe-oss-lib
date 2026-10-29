package com.openframe.stream.handler.software;

import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.stream.handler.software.FleetHostResolver.FleetHostRef;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetHostResolverTest {

    @Mock private ToolConnectionRepository toolConnectionRepository;
    @InjectMocks private FleetHostResolver resolver;

    private ToolConnection connection(String tenantId, String machineId) {
        ToolConnection c = new ToolConnection();
        c.setTenantId(tenantId);
        c.setMachineId(machineId);
        return c;
    }

    @Test
    void resolve_nullOrBlankId_returnsNullWithoutQuerying() {
        assertThat(resolver.resolve(null)).isNull();
        assertThat(resolver.resolve("   ")).isNull();
        verifyNoInteractions(toolConnectionRepository);
    }

    @Test
    void resolve_noConnection_returnsNull() {
        when(toolConnectionRepository.findFirstByAgentToolIdAndToolTypeOrderByConnectedAtDesc("100", ToolType.FLEET_MDM))
                .thenReturn(Optional.empty());
        assertThat(resolver.resolve("100")).isNull();
    }

    @Test
    void resolve_connection_mapsToTenantAndMachine() {
        when(toolConnectionRepository.findFirstByAgentToolIdAndToolTypeOrderByConnectedAtDesc("100", ToolType.FLEET_MDM))
                .thenReturn(Optional.of(connection("t1", "m1")));

        FleetHostRef ref = resolver.resolve("100");

        assertThat(ref).isNotNull();
        assertThat(ref.tenantId()).isEqualTo("t1");
        assertThat(ref.machineId()).isEqualTo("m1");
    }

    @Test
    void resolve_connectionMissingTenantOrMachine_returnsNull() {
        when(toolConnectionRepository.findFirstByAgentToolIdAndToolTypeOrderByConnectedAtDesc("100", ToolType.FLEET_MDM))
                .thenReturn(Optional.of(connection(null, "m1")));
        assertThat(resolver.resolve("100")).isNull();

        when(toolConnectionRepository.findFirstByAgentToolIdAndToolTypeOrderByConnectedAtDesc("200", ToolType.FLEET_MDM))
                .thenReturn(Optional.of(connection("t1", null)));
        assertThat(resolver.resolve("200")).isNull();
    }
}
