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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

    private void connected(String fleetHostId, ToolConnection connection) {
        when(toolConnectionRepository.findFirstByAgentToolIdAndToolTypeOrderByConnectedAtDesc(fleetHostId, ToolType.FLEET_MDM))
                .thenReturn(Optional.ofNullable(connection));
    }

    @Test
    void nullOrBlankId_isNotResolvable_withoutQuerying() {
        assertThat(resolver.isResolvable(null)).isFalse();
        assertThat(resolver.isResolvable("   ")).isFalse();
        verifyNoInteractions(toolConnectionRepository);
    }

    @Test
    void noConnection_isNotResolvable_andResolveThrows() {
        connected("100", null);

        assertThat(resolver.isResolvable("100")).isFalse();
        assertThatThrownBy(() -> resolver.resolve("100")).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void connection_isResolvable_andMapsToTenantAndMachine() {
        connected("100", connection("t1", "m1"));

        assertThat(resolver.isResolvable("100")).isTrue();
        FleetHostRef ref = resolver.resolve("100");
        assertThat(ref.tenantId()).isEqualTo("t1");
        assertThat(ref.machineId()).isEqualTo("m1");
    }

    @Test
    void connectionMissingTenantOrMachine_isNotResolvable() {
        connected("100", connection(null, "m1"));
        connected("200", connection("t1", null));

        assertThat(resolver.isResolvable("100")).isFalse();
        assertThat(resolver.isResolvable("200")).isFalse();
    }
}
