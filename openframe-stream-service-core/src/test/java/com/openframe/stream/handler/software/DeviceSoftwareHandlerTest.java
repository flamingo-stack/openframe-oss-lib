package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.sdk.fleetmdm.model.HostSoftwareInstalledVersion;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import com.openframe.stream.handler.software.FleetHostResolver.FleetHostRef;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceSoftwareHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private FleetHostResolver fleetHostResolver;
    @Mock private FleetHostSoftwareCache fleetHostSoftwareCache;
    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;
    @Mock private SoftwareProjector softwareProjector;

    @InjectMocks private DeviceSoftwareHandler handler;

    private DeserializedDebeziumMessage msg(String op, JsonNode before, JsonNode after) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation(op);
        payload.setBefore(before);
        payload.setAfter(after);
        DeserializedDebeziumMessage m = new DeserializedDebeziumMessage();
        m.setPayload(payload);
        return m;
    }

    private ObjectNode row() {
        return MAPPER.createObjectNode();
    }

    private HostSoftwareTitle title(long id, String name, String source, String... versions) {
        HostSoftwareTitle t = new HostSoftwareTitle();
        t.setId(id);
        t.setName(name);
        t.setSource(source);
        t.setInstalledVersions(java.util.Arrays.stream(versions).map(v -> {
            HostSoftwareInstalledVersion iv = new HostSoftwareInstalledVersion();
            iv.setVersion(v);
            return iv;
        }).toList());
        return t;
    }

    @Test
    void handle_nullPayload_isNoOp() {
        DeserializedDebeziumMessage m = new DeserializedDebeziumMessage();
        m.setPayload(null);
        handler.handle(m, null);
        verifyNoInteractions(fleetHostResolver, fleetHostSoftwareCache, deviceSoftwareRepository);
    }

    @Test
    void handle_nullRow_isNoOp() {
        handler.handle(msg("c", null, null), null);
        verifyNoInteractions(fleetHostResolver, fleetHostSoftwareCache, deviceSoftwareRepository);
    }

    @Test
    void handle_missingHostId_isNoOp() {
        handler.handle(msg("c", null, row().put("software_id", 200)), null);
        verifyNoInteractions(fleetHostResolver, fleetHostSoftwareCache, deviceSoftwareRepository);
    }

    @Test
    void handle_unresolvedHost_skips() {
        when(fleetHostResolver.resolve("100")).thenReturn(null);

        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        verifyNoInteractions(fleetHostSoftwareCache, deviceSoftwareRepository, softwareProjector);
    }

    @Test
    void handle_reconcile_upsertsSnapshotTitlesDeletesStaleAndProjects() {
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L)).thenReturn(List.of(
                title(42L, "Google Chrome", "apps", "1.0", "2.0")));
        when(deviceSoftwareRepository.findByTenantIdAndMachineIdAndSoftwareTitleId("t1", "m1", 42L))
                .thenReturn(Optional.empty());
        // stale row for a title no longer present in the snapshot
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of(
                DeviceSoftware.builder().tenantId("t1").machineId("m1").softwareTitleId(42L).build(),
                DeviceSoftware.builder().tenantId("t1").machineId("m1").softwareTitleId(99L).build()));

        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        ArgumentCaptor<DeviceSoftware> captor = ArgumentCaptor.forClass(DeviceSoftware.class);
        verify(deviceSoftwareRepository).save(captor.capture());
        DeviceSoftware saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo("t1");
        assertThat(saved.getMachineId()).isEqualTo("m1");
        assertThat(saved.getHostId()).isEqualTo(100L);
        assertThat(saved.getSoftwareTitleId()).isEqualTo(42L);
        assertThat(saved.getName()).isEqualTo("Google Chrome");
        assertThat(saved.getSource()).isEqualTo("apps");
        assertThat(saved.getVersions()).containsExactly("1.0", "2.0");
        assertThat(saved.getLastSeenAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();

        ArgumentCaptor<DeviceSoftware> deleted = ArgumentCaptor.forClass(DeviceSoftware.class);
        verify(deviceSoftwareRepository).delete(deleted.capture());
        assertThat(deleted.getValue().getSoftwareTitleId()).isEqualTo(99L);

        verify(softwareProjector).project("t1", 42L);
        verify(softwareProjector).project("t1", 99L);
    }

    @Test
    void handle_deleteEvent_reReconcilesFromSnapshot() {
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L)).thenReturn(List.of());
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of(
                DeviceSoftware.builder().tenantId("t1").machineId("m1").softwareTitleId(42L).build()));

        handler.handle(msg("d", row().put("host_id", 100), null), null);

        verify(deviceSoftwareRepository, never()).save(any());
        verify(deviceSoftwareRepository).delete(any(DeviceSoftware.class));
        verify(softwareProjector).project(eq("t1"), eq(42L));
    }
}
