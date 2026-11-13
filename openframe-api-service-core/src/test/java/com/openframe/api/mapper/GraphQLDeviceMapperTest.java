package com.openframe.api.mapper;

import com.openframe.api.dto.AvailableDeviceEdge;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.device.DeviceEnrollmentResponse;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilterInput;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Set;

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
    @DisplayName("toDeviceFilterCriteria carries connectivity next to statuses")
    void toDeviceFilterCriteria_carriesConnectivity() {
        // setup
        DeviceFilterInput input = DeviceFilterInput.builder()
                .statuses(List.of(DeviceStatus.ONLINE))
                .connectivity(List.of(TelemetryStatus.OFFLINE))
                .build();

        // execution
        DeviceFilterCriteria criteria = mapper.toDeviceFilterCriteria(input);

        // verifications
        assertThat(criteria.getStatuses()).containsExactly(DeviceStatus.ONLINE);
        assertThat(criteria.getConnectivity()).containsExactly(TelemetryStatus.OFFLINE);
    }

    @Test
    @DisplayName("available-device cursor buckets by telemetryStatus: status ONLINE with telemetry OFFLINE is the not-online bucket")
    void toAvailableDeviceConnection_bucketReadsTelemetryStatus() {
        // setup
        Machine staleStatus = machine(CONNECTED);
        staleStatus.setId("64f000000000000000000001");
        staleStatus.setStatus(DeviceStatus.ONLINE);
        staleStatus.setTelemetryStatus(TelemetryStatus.OFFLINE);
        Machine online = machine(CONNECTED);
        online.setId("64f000000000000000000002");
        online.setMachineId("m-2");
        online.setStatus(DeviceStatus.OFFLINE);
        online.setTelemetryStatus(TelemetryStatus.ONLINE);
        CountedGenericQueryResult<Machine> result = CountedGenericQueryResult.<Machine>builder()
                .items(List.of(staleStatus, online)).build();

        // execution
        CountedGenericConnection<AvailableDeviceEdge> connection = mapper.toAvailableDeviceConnection(result, Set.of("m-1"));

        // verifications
        assertThat(connection.getEdges())
                .extracting(edge -> CursorCodec.decode(edge.getCursor()))
                .containsExactly("1|64f000000000000000000001", "2|64f000000000000000000002");
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

    @Test
    @DisplayName("directorySources: a machine no directory integration wrote (every OSS machine) reads []")
    void toDirectorySources_nullStored_emptyList() {
        assertThat(mapper.toDirectorySources(machine(null))).isEmpty();
    }

    @Test
    @DisplayName("directorySources: stored sources are returned as they are")
    void toDirectorySources_stored_returned() {
        Machine machine = machine(null);
        machine.setDirectorySources(List.of(DirectorySource.MICROSOFT_365));

        assertThat(mapper.toDirectorySources(machine)).containsExactly(DirectorySource.MICROSOFT_365);
    }

    @Test
    @DisplayName("directoryUserLink: a machine without a link reads NONE")
    void toDirectoryUserLink_nullStored_none() {
        assertThat(mapper.toDirectoryUserLink(machine(null))).isEqualTo(DirectoryUserLink.NONE);
    }

    @Test
    @DisplayName("directoryUserLink: a stored link is returned")
    void toDirectoryUserLink_stored_returned() {
        Machine machine = machine(null);
        machine.setDirectoryUserLink(DirectoryUserLink.SHARED);

        assertThat(mapper.toDirectoryUserLink(machine)).isEqualTo(DirectoryUserLink.SHARED);
    }

    @Test
    @DisplayName("directoryUserIds: null reads [], stored ids keep their order (the primary user first)")
    void toDirectoryUserIds_nullAndStored() {
        Machine stored = machine(null);
        stored.setDirectoryUserIds(List.of("acc-2", "acc-1"));

        assertThat(mapper.toDirectoryUserIds(machine(null))).isEmpty();
        assertThat(mapper.toDirectoryUserIds(stored)).containsExactly("acc-2", "acc-1");
    }

    @Test
    @DisplayName("toDeviceFilterCriteria: the SOURCES and USER filters are copied from the input")
    void toDeviceFilterCriteria_directoryFilters_copied() {
        DeviceFilterInput input = DeviceFilterInput.builder()
                .directorySources(List.of(DirectorySource.MICROSOFT_365))
                .userLinks(List.of(DirectoryUserLink.PRIMARY, DirectoryUserLink.NONE))
                .build();

        DeviceFilterCriteria criteria = mapper.toDeviceFilterCriteria(input);

        assertThat(criteria.getDirectorySources()).containsExactly(DirectorySource.MICROSOFT_365);
        assertThat(criteria.getUserLinks()).containsExactly(DirectoryUserLink.PRIMARY, DirectoryUserLink.NONE);
    }
}
