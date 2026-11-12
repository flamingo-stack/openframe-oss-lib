package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.service.rmm.software.SoftwareProjectionTrigger;
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
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceSoftwareHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();
    private static final long COMMIT_TS = 1_793_700_000_000L;

    @Mock private FleetHostResolver fleetHostResolver;
    @Mock private FleetHostSoftwareCache fleetHostSoftwareCache;
    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;
    @Mock private SoftwareProjectionTrigger projectionTrigger;

    @InjectMocks private DeviceSoftwareHandler handler;

    private DeserializedDebeziumMessage msg(String op, JsonNode before, JsonNode after) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation(op);
        payload.setBefore(before);
        payload.setAfter(after);
        DebeziumMessage.Payload.Source source = new DebeziumMessage.Payload.Source();
        source.setTimestamp(COMMIT_TS);
        payload.setSource(source);
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

    private HostSoftwareTitle titleWithCves(long id, String name, String version, String... cves) {
        HostSoftwareTitle t = title(id, name, "apps", version);
        t.getInstalledVersions().get(0).setVulnerabilities(List.of(cves));
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
        when(fleetHostResolver.isResolvable("100")).thenReturn(false);

        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        verifyNoInteractions(fleetHostSoftwareCache, deviceSoftwareRepository, projectionTrigger);
    }

    @Test
    void handle_reconcile_upsertsSnapshotTitlesDeletesStaleAndProjects() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, COMMIT_TS)).thenReturn(List.of(
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
        assertThat(saved.getSoftwareTitleId()).isEqualTo(42L);
        assertThat(saved.getName()).isEqualTo("Google Chrome");
        assertThat(saved.getSource()).isEqualTo("apps");
        assertThat(saved.getVersions()).containsExactly("1.0", "2.0");
        assertThat(saved.getUpdatedAt()).isNotNull();
        // a new row is written for a device reporting software, so it counts until a lifecycle change says otherwise
        assertThat(saved.isMachineConnected()).isTrue();

        ArgumentCaptor<DeviceSoftware> deleted = ArgumentCaptor.forClass(DeviceSoftware.class);
        verify(deviceSoftwareRepository).delete(deleted.capture());
        assertThat(deleted.getValue().getSoftwareTitleId()).isEqualTo(99L);

        verify(projectionTrigger).titlesChanged("t1", Set.of(42L, 99L));
    }

    @Test
    void handle_reconcile_setsVulnerabilitiesAndProjectsAffectedCves() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, COMMIT_TS)).thenReturn(List.of(
                titleWithCves(42L, "Google Chrome", "1.0", "CVE-1", "CVE-2")));
        when(deviceSoftwareRepository.findByTenantIdAndMachineIdAndSoftwareTitleId("t1", "m1", 42L))
                .thenReturn(Optional.empty());
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of());

        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        ArgumentCaptor<DeviceSoftware> captor = ArgumentCaptor.forClass(DeviceSoftware.class);
        verify(deviceSoftwareRepository).save(captor.capture());
        assertThat(captor.getValue().getVulnerabilities()).containsExactly("CVE-1", "CVE-2");

        verify(projectionTrigger).titlesChanged("t1", Set.of(42L));
        verify(projectionTrigger).cvesChanged("t1", Set.of("CVE-1", "CVE-2"));
    }

    @Test
    void handle_deleteEvent_reReconcilesFromSnapshot() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, COMMIT_TS)).thenReturn(List.of());
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of(
                DeviceSoftware.builder().tenantId("t1").machineId("m1").softwareTitleId(42L).build()));

        handler.handle(msg("d", row().put("host_id", 100), null), null);

        verify(deviceSoftwareRepository, never()).save(any());
        verify(deviceSoftwareRepository).delete(any(DeviceSoftware.class));
        verify(projectionTrigger).titlesChanged(eq("t1"), eq(Set.of(42L)));
    }

    // a later commit on the same host must not reuse the list fetched for an earlier one
    @Test
    void handle_eachCommitReadsFleetOnce_keyedByTheSourceCommitTime() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of());
        DeserializedDebeziumMessage noSource = msg("c", null, row().put("host_id", 100));
        noSource.getPayload().setSource(null);
        noSource.getPayload().setTimestamp(555L);

        handler.handle(msg("c", null, row().put("host_id", 100)), null);
        handler.handle(noSource, null);

        verify(fleetHostSoftwareCache).hostSoftware("t1", 100L, COMMIT_TS);
        verify(fleetHostSoftwareCache).hostSoftware("t1", 100L, 555L);
    }

    @Test
    void handle_snapshotReads_reconcileEachHostOnce() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.isResolvable("101")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetHostResolver.resolve("101")).thenReturn(new FleetHostRef("t1", "m2"));

        handler.handle(msg("r", null, row().put("host_id", 100).put("software_id", 1)), null);
        handler.handle(msg("r", null, row().put("host_id", 100).put("software_id", 2)), null);
        handler.handle(msg("r", null, row().put("host_id", 101).put("software_id", 1)), null);
        handler.handle(msg("r", null, row().put("host_id", 100).put("software_id", 3)), null);

        verify(fleetHostSoftwareCache, times(1)).hostSoftware("t1", 100L, COMMIT_TS);
        verify(fleetHostSoftwareCache, times(1)).hostSoftware("t1", 101L, COMMIT_TS);
        verify(fleetHostResolver, times(1)).resolve("100");
        verify(projectionTrigger, times(2)).titlesChanged(eq("t1"), any());
    }

    @Test
    void handle_snapshotReadThatFailed_isReconciledByTheNextRowOfTheHost() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, COMMIT_TS))
                .thenThrow(new IllegalStateException("Fleet 503"))
                .thenReturn(List.of());

        assertThatThrownBy(() -> handler.handle(msg("r", null, row().put("host_id", 100)), null))
                .isInstanceOf(IllegalStateException.class);
        handler.handle(msg("r", null, row().put("host_id", 100)), null);

        verify(fleetHostSoftwareCache, times(2)).hostSoftware("t1", 100L, COMMIT_TS);
        verify(projectionTrigger).titlesChanged(eq("t1"), any());
    }

    @Test
    void handle_changeEventsAfterASnapshotRead_alwaysReconcile() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));

        handler.handle(msg("r", null, row().put("host_id", 100)), null);
        handler.handle(msg("u", row().put("host_id", 100), row().put("host_id", 100)), null);
        handler.handle(msg("c", null, row().put("host_id", 100)), null);
        handler.handle(msg("d", row().put("host_id", 100), null), null);

        verify(fleetHostSoftwareCache, times(4)).hostSoftware("t1", 100L, COMMIT_TS);
    }

    @Test
    void handle_reconcile_keepsWhatTheWindowsProgramsTableReports() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        HostSoftwareTitle chrome = title(42L, "Google Chrome", "programs", "130.0", "129.0");
        chrome.setUpgradeCode("{UPGRADE}");
        HostSoftwareInstalledVersion exe = chrome.getInstalledVersions().get(0);
        exe.setVendor("Google LLC");
        exe.setArpKey("Google Chrome");
        exe.setInstallerType("exe");
        exe.setSystemComponent(false);
        HostSoftwareInstalledVersion msi = chrome.getInstalledVersions().get(1);
        msi.setArpKey("{8A69D345-D564-463C-AFF1-A69D9E530F96}");
        msi.setPackageFamilyName("");
        msi.setInstallerType("msi");
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, COMMIT_TS)).thenReturn(List.of(chrome));
        when(deviceSoftwareRepository.findByTenantIdAndMachineIdAndSoftwareTitleId("t1", "m1", 42L))
                .thenReturn(Optional.empty());

        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        ArgumentCaptor<DeviceSoftware> captor = ArgumentCaptor.forClass(DeviceSoftware.class);
        verify(deviceSoftwareRepository).save(captor.capture());
        DeviceSoftware saved = captor.getValue();
        assertThat(saved.getUpgradeCode()).isEqualTo("{UPGRADE}");
        assertThat(saved.getVendor()).isEqualTo("Google LLC");
        assertThat(saved.getArpKeys()).containsExactly("Google Chrome", "{8A69D345-D564-463C-AFF1-A69D9E530F96}");
        assertThat(saved.getPackageFamilyNames()).isEmpty();
        assertThat(saved.getInstallerTypes()).containsExactly("exe", "msi");
        assertThat(saved.getSystemComponent()).isFalse();
        assertThat(saved.getWingetId()).isNull();
    }

    @Test
    void handle_reconcile_keepsTheWingetIdOfAWingetPackage() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        HostSoftwareTitle sevenZip = title(43L, "7-Zip", "winget_packages", "24.08");
        sevenZip.getInstalledVersions().get(0).setWingetId("7zip.7zip");
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, COMMIT_TS)).thenReturn(List.of(sevenZip));
        when(deviceSoftwareRepository.findByTenantIdAndMachineIdAndSoftwareTitleId("t1", "m1", 43L))
                .thenReturn(Optional.empty());

        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        ArgumentCaptor<DeviceSoftware> captor = ArgumentCaptor.forClass(DeviceSoftware.class);
        verify(deviceSoftwareRepository).save(captor.capture());
        assertThat(captor.getValue().getWingetId()).isEqualTo("7zip.7zip");
    }

    @Test
    void handle_reconcile_noVersionReportsTheFlag_systemComponentUnknown() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, COMMIT_TS))
                .thenReturn(List.of(title(42L, "Slack", "apps", "4.0")));
        when(deviceSoftwareRepository.findByTenantIdAndMachineIdAndSoftwareTitleId("t1", "m1", 42L))
                .thenReturn(Optional.empty());

        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        ArgumentCaptor<DeviceSoftware> captor = ArgumentCaptor.forClass(DeviceSoftware.class);
        verify(deviceSoftwareRepository).save(captor.capture());
        assertThat(captor.getValue().getSystemComponent()).isNull();
        assertThat(captor.getValue().getVendor()).isNull();
    }
}
