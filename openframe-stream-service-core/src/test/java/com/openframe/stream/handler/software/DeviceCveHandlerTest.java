package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.sdk.fleetmdm.model.HostSoftwareInstalledVersion;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import com.openframe.stream.handler.software.FleetHostResolver.FleetHostRef;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceCveHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private FleetHostResolver fleetHostResolver;
    @Mock private FleetHostSoftwareCache fleetHostSoftwareCache;
    @Mock private DeviceCveRepository deviceCveRepository;
    @Mock private DeviceCveWriter deviceCveWriter;
    @Mock private SoftwareProjector softwareProjector;
    @Mock private VulnerabilityProjector vulnerabilityProjector;

    @InjectMocks private DeviceCveHandler handler;

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

    private HostSoftwareTitle title(long id, String name, String version, String... cves) {
        HostSoftwareTitle t = new HostSoftwareTitle();
        t.setId(id);
        t.setName(name);
        HostSoftwareInstalledVersion iv = new HostSoftwareInstalledVersion();
        iv.setVersion(version);
        iv.setVulnerabilities(List.of(cves));
        t.setInstalledVersions(List.of(iv));
        return t;
    }

    @Test
    void handle_nullPayload_isNoOp() {
        DeserializedDebeziumMessage m = new DeserializedDebeziumMessage();
        m.setPayload(null);
        handler.handle(m, null);
        verifyNoInteractions(fleetHostResolver, fleetHostSoftwareCache, deviceCveWriter);
    }

    @Test
    void handle_missingHostId_isNoOp() {
        handler.handle(msg("c", null, row().put("software_id", 200)), null);
        verifyNoInteractions(fleetHostResolver, fleetHostSoftwareCache, deviceCveWriter);
    }

    @Test
    void handle_unresolvedHost_skips() {
        when(fleetHostResolver.resolve("100")).thenReturn(null);
        handler.handle(msg("c", null, row().put("host_id", 100)), null);
        verifyNoInteractions(fleetHostSoftwareCache, deviceCveWriter, softwareProjector, vulnerabilityProjector);
    }

    @Test
    void handle_reconcile_upsertsPerCveDeletesStaleThenProjects() {
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L)).thenReturn(List.of(
                title(42L, "Chrome", "1.0", "CVE-1", "CVE-2")));
        // one stale device_cve row whose CVE is no longer present in the snapshot
        when(deviceCveRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of(
                DeviceCve.builder().cveId("CVE-OLD").softwareTitleId(7L).build()));

        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        verify(deviceCveWriter).upsert("t1", "m1", 100L, "CVE-1", 42L, "Chrome", "1.0");
        verify(deviceCveWriter).upsert("t1", "m1", 100L, "CVE-2", 42L, "Chrome", "1.0");
        verify(deviceCveRepository).delete(any(DeviceCve.class));
        verify(softwareProjector).project("t1", 42L);
        verify(softwareProjector).project("t1", 7L);
        verify(vulnerabilityProjector).project("t1", "CVE-1");
        verify(vulnerabilityProjector).project("t1", "CVE-2");
        verify(vulnerabilityProjector).project("t1", "CVE-OLD");
    }

    @Test
    void handle_deleteEvent_reReconcilesAndClearsRemovedCves() {
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L)).thenReturn(List.of());
        when(deviceCveRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of(
                DeviceCve.builder().cveId("CVE-OLD").softwareTitleId(42L).build()));

        handler.handle(msg("d", row().put("host_id", 100), null), null);

        verify(deviceCveWriter, never()).upsert(any(), any(), any(), any(), any(), any(), any());
        verify(deviceCveRepository).delete(any(DeviceCve.class));
        verify(softwareProjector).project("t1", 42L);
        verify(vulnerabilityProjector).project("t1", "CVE-OLD");
    }
}
