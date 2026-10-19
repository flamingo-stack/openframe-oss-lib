package com.openframe.api.mapper;

import com.openframe.api.dto.device.DeviceEnrollmentResponse;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The setup wizard's enrollment milestones are derived here, from the machine document and its tool
 * connections: registered (machine exists), connected (first NATS connection), inventory connected
 * (Fleet confirmed the host, i.e. the FLEET_MDM connection is CONNECTED with a numeric Fleet host id).
 */
class GraphQLDeviceMapperTest {

    private static final Instant REGISTERED = Instant.parse("2026-10-12T10:00:00Z");
    private static final Instant CONNECTED = Instant.parse("2026-10-12T10:00:20Z");
    private static final Instant INVENTORY = Instant.parse("2026-10-12T10:02:30Z");

    private final GraphQLDeviceMapper mapper = new GraphQLDeviceMapper();

    private static Machine machine(Instant firstConnectedAt) {
        Machine machine = new Machine();
        machine.setMachineId("m-1");
        machine.setRegisteredAt(REGISTERED);
        machine.setFirstConnectedAt(firstConnectedAt);
        return machine;
    }

    private static ToolConnection connection(ToolType toolType, ConnectionStatus status, String agentToolId) {
        ToolConnection connection = new ToolConnection();
        connection.setMachineId("m-1");
        connection.setToolType(toolType);
        connection.setStatus(status);
        connection.setAgentToolId(agentToolId);
        connection.setConnectedAt(INVENTORY);
        return connection;
    }

    private static ToolConnection fleet(ConnectionStatus status, String agentToolId) {
        return connection(ToolType.FLEET_MDM, status, agentToolId);
    }

    @Test
    @DisplayName("registeredAt is the machine's registeredAt")
    void toEnrollment_registeredAtIsTheMachineRegisteredAt() {
        DeviceEnrollmentResponse enrollment = mapper.toEnrollment(machine(null), List.of());

        assertThat(enrollment.getRegisteredAt()).isEqualTo(REGISTERED);
    }

    @Test
    @DisplayName("connectedAt is the machine's firstConnectedAt, null while still PENDING")
    void toEnrollment_connectedAtIsFirstConnectedAt() {
        assertThat(mapper.toEnrollment(machine(CONNECTED), List.of()).getConnectedAt()).isEqualTo(CONNECTED);
        assertThat(mapper.toEnrollment(machine(null), List.of()).getConnectedAt()).isNull();
    }

    @Test
    @DisplayName("a CONNECTED FLEET_MDM connection with a numeric Fleet host id sets inventoryConnectedAt")
    void toEnrollment_fleetConnectedWithNumericHostId_setsInventoryConnectedAt() {
        DeviceEnrollmentResponse enrollment = mapper.toEnrollment(machine(CONNECTED),
                List.of(fleet(ConnectionStatus.CONNECTED, "42")));

        assertThat(enrollment.getInventoryConnectedAt()).isEqualTo(INVENTORY);
    }

    @Test
    @DisplayName("a FLEET_MDM connection that fell back to the raw UUID (Fleet never confirmed) leaves inventoryConnectedAt null")
    void toEnrollment_fleetConnectedWithRawUuid_leavesInventoryNull() {
        DeviceEnrollmentResponse enrollment = mapper.toEnrollment(machine(CONNECTED),
                List.of(fleet(ConnectionStatus.CONNECTED, "0f1d4c2e-7b3a-4c1d-9e2f-5a6b7c8d9e0f")));

        assertThat(enrollment.getInventoryConnectedAt()).isNull();
        assertThat(enrollment.isReady()).isFalse();
    }

    @Test
    @DisplayName("a DISCONNECTED FLEET_MDM connection leaves inventoryConnectedAt null")
    void toEnrollment_fleetDisconnected_leavesInventoryNull() {
        DeviceEnrollmentResponse enrollment = mapper.toEnrollment(machine(CONNECTED),
                List.of(fleet(ConnectionStatus.DISCONNECTED, "42")));

        assertThat(enrollment.getInventoryConnectedAt()).isNull();
    }

    @Test
    @DisplayName("without a FLEET_MDM row (MeshCentral only, even with a numeric id) inventoryConnectedAt is null")
    void toEnrollment_noFleetRow_leavesInventoryNull() {
        DeviceEnrollmentResponse enrollment = mapper.toEnrollment(machine(CONNECTED),
                List.of(connection(ToolType.MESHCENTRAL, ConnectionStatus.CONNECTED, "7")));

        assertThat(enrollment.getInventoryConnectedAt()).isNull();
    }

    @Test
    @DisplayName("a null connection list is the same as no connections")
    void toEnrollment_nullConnections_leavesInventoryNull() {
        DeviceEnrollmentResponse enrollment = mapper.toEnrollment(machine(CONNECTED), null);

        assertThat(enrollment.getInventoryConnectedAt()).isNull();
        assertThat(enrollment.isReady()).isFalse();
    }

    @Test
    @DisplayName("ready only when both connectedAt and inventoryConnectedAt are set")
    void toEnrollment_readyOnlyWhenBothTimestampsSet() {
        List<ToolConnection> inventory = List.of(fleet(ConnectionStatus.CONNECTED, "42"));

        assertThat(mapper.toEnrollment(machine(CONNECTED), inventory).isReady()).as("both").isTrue();
        assertThat(mapper.toEnrollment(machine(CONNECTED), List.of()).isReady()).as("connected only").isFalse();
        assertThat(mapper.toEnrollment(machine(null), inventory).isReady()).as("inventory only").isFalse();
        assertThat(mapper.toEnrollment(machine(null), List.of()).isReady()).as("neither").isFalse();
    }
}
