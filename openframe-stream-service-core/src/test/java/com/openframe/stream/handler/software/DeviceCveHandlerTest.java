package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.document.rmm.software.FleetSoftware;
import com.openframe.data.document.rmm.software.FleetSoftwareCve;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import com.openframe.data.repository.rmm.software.FleetOperatingSystemRepository;
import com.openframe.data.repository.rmm.software.FleetOsVulnerabilityRepository;
import com.openframe.data.repository.rmm.software.FleetSoftwareCveRepository;
import com.openframe.data.repository.rmm.software.FleetSoftwareRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceCveHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private FleetHostResolver fleetHostResolver;
    @Mock private FleetSoftwareCveRepository fleetSoftwareCveRepository;
    @Mock private FleetSoftwareRepository fleetSoftwareRepository;
    @Mock private FleetOsVulnerabilityRepository fleetOsVulnerabilityRepository;
    @Mock private FleetOperatingSystemRepository fleetOperatingSystemRepository;
    @Mock private DeviceCveRepository deviceCveRepository;
    @Mock private DeviceCveWriter deviceCveWriter;
    @Mock private SoftwareProjector softwareProjector;
    @Mock private VulnerabilityProjector vulnerabilityProjector;
    @Mock private SoftwareCascadeSyncService cascadeSyncService;

    @InjectMocks private DeviceCveHandler handler;

    private DeserializedDebeziumMessage msg(MessageType type, String op, JsonNode before, JsonNode after) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation(op);
        payload.setBefore(before);
        payload.setAfter(after);
        DeserializedDebeziumMessage m = new DeserializedDebeziumMessage();
        m.setPayload(payload);
        m.setMessageType(type);
        return m;
    }

    private ObjectNode row() {
        return MAPPER.createObjectNode();
    }

    @Test
    void handle_unrelatedMessageType_isNoOp() {
        handler.handle(msg(MessageType.FLEET_MDM_SOFTWARE_TITLE_EVENT, "c", null, row().put("x", 1)), null);
        verifyNoInteractions(fleetHostResolver, deviceCveWriter, softwareProjector, vulnerabilityProjector,
                cascadeSyncService);
    }

    @Test
    void hostSoftware_missingIds_isNoOp() {
        handler.handle(msg(MessageType.FLEET_MDM_HOST_SOFTWARE_EVENT, "c", null, row().put("host_id", 100)), null);
        verifyNoInteractions(fleetHostResolver, deviceCveWriter, softwareProjector, vulnerabilityProjector);
    }

    @Test
    void hostSoftware_unresolvedHost_skips() {
        when(fleetHostResolver.resolve("100")).thenReturn(null);
        handler.handle(msg(MessageType.FLEET_MDM_HOST_SOFTWARE_EVENT, "c", null,
                row().put("host_id", 100).put("software_id", 200)), null);
        verifyNoInteractions(deviceCveWriter, softwareProjector, vulnerabilityProjector);
    }

    @Test
    void hostSoftware_create_upsertsPerCveThenProjectsSoftwareAndEachVuln() {
        ObjectNode after = row().put("host_id", 100).put("software_id", 200);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(java.util.Optional.of(
                FleetSoftware.builder().softwareTitleId(42L).version("1.0").build()));
        when(fleetSoftwareCveRepository.findBySoftwareId(200L)).thenReturn(List.of(
                FleetSoftwareCve.builder().cve("CVE-1").build(),
                FleetSoftwareCve.builder().cve("CVE-2").build()));

        handler.handle(msg(MessageType.FLEET_MDM_HOST_SOFTWARE_EVENT, "c", null, after), null);

        verify(deviceCveWriter, times(2)).upsert(any(), any(), any(), any(), any(), any(), any(), any());
        verify(softwareProjector).project("t1", 42L);
        verify(vulnerabilityProjector).project("t1", "CVE-1");
        verify(vulnerabilityProjector).project("t1", "CVE-2");
    }

    @Test
    void hostSoftware_delete_deletesThenProjectsSoftwareAndRemovedVulns() {
        ObjectNode before = row().put("host_id", 100).put("software_id", 200);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(java.util.Optional.of(
                FleetSoftware.builder().softwareTitleId(42L).build()));
        when(deviceCveRepository.findByTenantIdAndMachineIdAndSoftwareId("t1", "m1", 200L)).thenReturn(List.of(
                DeviceCve.builder().cveId("CVE-OLD").build()));

        handler.handle(msg(MessageType.FLEET_MDM_HOST_SOFTWARE_EVENT, "d", before, null), null);

        verify(deviceCveRepository).deleteByTenantIdAndMachineIdAndSoftwareId("t1", "m1", 200L);
        verify(softwareProjector).project("t1", 42L);
        verify(vulnerabilityProjector).project("t1", "CVE-OLD");
        verify(deviceCveWriter, never()).upsert(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void softwareCve_create_updatesCatalogAndEnqueuesCascade() {
        ObjectNode after = row().put("software_id", 200).put("cve", "CVE-9").put("resolved_in_version", "3.0");
        when(fleetSoftwareCveRepository.findBySoftwareIdAndCve(200L, "CVE-9")).thenReturn(java.util.Optional.empty());

        handler.handle(msg(MessageType.FLEET_MDM_SOFTWARE_CVE_EVENT, "c", null, after), null);

        verify(fleetSoftwareCveRepository).save(any(FleetSoftwareCve.class));
        verify(cascadeSyncService).enqueueSoftwareCve(200L);
        verifyNoInteractions(deviceCveWriter, softwareProjector);
    }

    @Test
    void softwareCve_delete_removesCatalogAndEnqueuesCascade() {
        handler.handle(msg(MessageType.FLEET_MDM_SOFTWARE_CVE_EVENT, "d",
                row().put("software_id", 200).put("cve", "CVE-9"), null), null);
        verify(fleetSoftwareCveRepository).deleteBySoftwareIdAndCve(200L, "CVE-9");
        verify(cascadeSyncService).enqueueSoftwareCve(200L);
    }

    @Test
    void osVulnerability_create_updatesCatalogAndEnqueuesCascade() {
        ObjectNode after = row().put("operating_system_id", 7).put("cve", "CVE-OS").put("resolved_in_version", "14.6");
        when(fleetOsVulnerabilityRepository.findByOsIdAndCve(7L, "CVE-OS")).thenReturn(java.util.Optional.empty());

        handler.handle(msg(MessageType.FLEET_MDM_OS_VULNERABILITY_EVENT, "c", null, after), null);

        verify(fleetOsVulnerabilityRepository).save(any());
        verify(cascadeSyncService).enqueueOsVuln(7L);
    }

    @Test
    void osVulnerability_delete_removesCatalogAndEnqueuesCascade() {
        handler.handle(msg(MessageType.FLEET_MDM_OS_VULNERABILITY_EVENT, "d",
                row().put("operating_system_id", 7).put("cve", "CVE-OS"), null), null);
        verify(fleetOsVulnerabilityRepository).deleteByOsIdAndCve(7L, "CVE-OS");
        verify(cascadeSyncService).enqueueOsVuln(7L);
    }
}
