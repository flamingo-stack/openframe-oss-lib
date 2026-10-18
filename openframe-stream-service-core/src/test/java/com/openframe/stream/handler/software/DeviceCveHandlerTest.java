package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.FleetSoftware;
import com.openframe.data.document.rmm.software.FleetSoftwareCve;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import com.openframe.data.repository.rmm.software.DeviceOperatingSystemRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
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
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;
    @Mock private FleetOsVulnerabilityRepository fleetOsVulnerabilityRepository;
    @Mock private FleetOperatingSystemRepository fleetOperatingSystemRepository;
    @Mock private DeviceOperatingSystemRepository deviceOperatingSystemRepository;
    @Mock private DeviceCveRepository deviceCveRepository;
    @Mock private TenantSoftwareCveAggregator tenantSoftwareCveAggregator;

    @InjectMocks private DeviceCveHandler handler;

    private DeserializedDebeziumMessage msg(String table, String op, JsonNode before, JsonNode after) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        if (table != null) {
            DebeziumMessage.Payload.Source source = new DebeziumMessage.Payload.Source();
            source.setTable(table);
            payload.setSource(source);
        }
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

    private void verifyNothingWritten() {
        verify(deviceCveRepository, never()).save(any());
        verifyNoInteractions(tenantSoftwareCveAggregator);
    }

    @Test
    void handle_unknownTable_isNoOp() {
        handler.handle(msg("some_other_table", "c", null, row().put("x", 1)), null);
        verifyNoInteractions(fleetHostResolver, fleetSoftwareRepository, fleetSoftwareCveRepository,
                deviceSoftwareRepository, deviceCveRepository, tenantSoftwareCveAggregator);
    }

    @Test
    void handle_nullSource_isNoOp() {
        handler.handle(msg(null, "c", null, row().put("host_id", 1)), null);
        verifyNoInteractions(fleetHostResolver, deviceCveRepository, tenantSoftwareCveAggregator);
    }

    @Test
    void hostSoftware_missingIds_isNoOp() {
        handler.handle(msg("host_software", "c", null, row().put("host_id", 100)), null);  // no software_id
        verifyNoInteractions(fleetHostResolver, deviceCveRepository, tenantSoftwareCveAggregator);
    }

    @Test
    void hostSoftware_unresolvedHost_skipsWithoutCatalogLookupOrWrite() {
        ObjectNode after = row().put("host_id", 100).put("software_id", 200);
        when(fleetHostResolver.resolve("100")).thenReturn(null);

        handler.handle(msg("host_software", "c", null, after), null);

        verifyNoInteractions(fleetSoftwareRepository, fleetSoftwareCveRepository);
        verifyNothingWritten();
    }

    @Test
    void hostSoftware_create_upsertsOneDeviceCvePerKnownCveThenRecomputes() {
        ObjectNode after = row().put("host_id", 100).put("software_id", 200);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(Optional.of(
                FleetSoftware.builder().softwareTitleId(42L).version("1.0").build()));
        when(fleetSoftwareCveRepository.findBySoftwareId(200L)).thenReturn(List.of(
                FleetSoftwareCve.builder().cve("CVE-1").resolvedInVersion("2.0").build(),
                FleetSoftwareCve.builder().cve("CVE-2").build()));
        when(deviceCveRepository.findByTenantIdAndMachineIdAndCveIdAndSoftwareId(any(), any(), any(), any()))
                .thenReturn(Optional.empty());

        handler.handle(msg("host_software", "c", null, after), null);

        verify(deviceCveRepository, times(2)).save(any(DeviceCve.class));
        verify(tenantSoftwareCveAggregator).recompute("t1", 42L);
    }

    @Test
    void hostSoftware_create_withNoKnownCve_writesNothingAndSkipsRecompute() {
        ObjectNode after = row().put("host_id", 100).put("software_id", 200);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(Optional.of(
                FleetSoftware.builder().softwareTitleId(42L).version("1.0").build()));
        when(fleetSoftwareCveRepository.findBySoftwareId(200L)).thenReturn(List.of());

        handler.handle(msg("host_software", "c", null, after), null);

        verifyNothingWritten();
    }

    @Test
    void hostSoftware_delete_deletesDeviceCvesAndRecomputes() {
        ObjectNode before = row().put("host_id", 100).put("software_id", 200);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(Optional.of(
                FleetSoftware.builder().softwareTitleId(42L).build()));

        handler.handle(msg("host_software", "d", before, null), null);

        verify(deviceCveRepository).deleteByTenantIdAndMachineIdAndSoftwareId("t1", "m1", 200L);
        verify(tenantSoftwareCveAggregator).recompute("t1", 42L);
        verify(deviceCveRepository, never()).save(any());
    }

    @Test
    void softwareCve_create_fansOutToDeviceSoftwareRowsAndRecomputesPerTenant() {
        ObjectNode after = row().put("software_id", 200).put("cve", "CVE-9").put("resolved_in_version", "3.0");
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(Optional.of(
                FleetSoftware.builder().softwareTitleId(42L).version("1.0").build()));
        when(fleetSoftwareCveRepository.findBySoftwareIdAndCve(200L, "CVE-9")).thenReturn(Optional.empty());
        when(deviceSoftwareRepository.findBySoftwareId(200L)).thenReturn(List.of(
                DeviceSoftware.builder().tenantId("t1").machineId("m1").hostId(100L).softwareTitleId(42L).version("1.0").build(),
                DeviceSoftware.builder().tenantId("t2").machineId("m2").hostId(101L).softwareTitleId(42L).version("1.0").build()));
        when(deviceCveRepository.findByTenantIdAndMachineIdAndCveIdAndSoftwareId(any(), any(), any(), any()))
                .thenReturn(Optional.empty());

        handler.handle(msg("software_cve", "c", null, after), null);

        verify(fleetSoftwareCveRepository).save(any(FleetSoftwareCve.class));   // catalog upsert
        verify(deviceCveRepository, times(2)).save(any(DeviceCve.class));
        verify(tenantSoftwareCveAggregator).recompute("t1", 42L);
        verify(tenantSoftwareCveAggregator).recompute("t2", 42L);
    }

    @Test
    void softwareCve_delete_removesCatalogAndDeviceCvesPerDeviceSoftwareRow() {
        ObjectNode before = row().put("software_id", 200).put("cve", "CVE-9");
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(Optional.empty());
        when(deviceSoftwareRepository.findBySoftwareId(200L)).thenReturn(List.of(
                DeviceSoftware.builder().tenantId("t1").machineId("m1").hostId(100L).build()));

        handler.handle(msg("software_cve", "d", before, null), null);

        verify(fleetSoftwareCveRepository).deleteBySoftwareIdAndCve(200L, "CVE-9");
        verify(deviceCveRepository).deleteByTenantIdAndMachineIdAndCveIdAndSoftwareId("t1", "m1", "CVE-9", 200L);
        verify(tenantSoftwareCveAggregator).recompute(eq("t1"), any());
    }
}
