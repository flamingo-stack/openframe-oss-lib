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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

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
    private static final String GTID_1 = "3e11fa47-71ca-11e1-9e33-c80aa9429562:101";
    private static final String GTID_2 = "3e11fa47-71ca-11e1-9e33-c80aa9429562:102";

    @Mock private FleetHostResolver fleetHostResolver;
    @Mock private FleetHostSoftwareCache fleetHostSoftwareCache;
    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;
    @Mock private SoftwareProjectionTrigger projectionTrigger;

    @Captor private ArgumentCaptor<DeviceSoftware> deviceSoftwareCaptor;

    @InjectMocks private DeviceSoftwareHandler handler;

    private DeserializedDebeziumMessage msg(String op, JsonNode before, JsonNode after) {
        return msgAt(op, before, after, COMMIT_TS);
    }

    private DeserializedDebeziumMessage msgAt(String op, JsonNode before, JsonNode after, long commitTs) {
        return msgIn(op, before, after, commitTs, null);
    }

    private DeserializedDebeziumMessage msgIn(String op, JsonNode before, JsonNode after, long commitTs, String gtid) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation(op);
        payload.setBefore(before);
        payload.setAfter(after);
        DebeziumMessage.Payload.Source source = new DebeziumMessage.Payload.Source();
        source.setTimestamp(commitTs);
        source.setGtid(gtid);
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
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, String.valueOf(COMMIT_TS))).thenReturn(List.of(
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
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, String.valueOf(COMMIT_TS))).thenReturn(List.of(
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
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, String.valueOf(COMMIT_TS))).thenReturn(List.of());
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

        verify(fleetHostSoftwareCache).hostSoftware("t1", 100L, String.valueOf(COMMIT_TS));
        verify(fleetHostSoftwareCache).hostSoftware("t1", 100L, "555");
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

        verify(fleetHostSoftwareCache, times(1)).hostSoftware("t1", 100L, String.valueOf(COMMIT_TS));
        verify(fleetHostSoftwareCache, times(1)).hostSoftware("t1", 101L, String.valueOf(COMMIT_TS));
        verify(fleetHostResolver, times(1)).resolve("100");
        verify(projectionTrigger, times(2)).titlesChanged(eq("t1"), any());
    }

    @Test
    void handle_snapshotReadThatFailed_isReconciledByTheNextRowOfTheHost() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, String.valueOf(COMMIT_TS)))
                .thenThrow(new IllegalStateException("Fleet 503"))
                .thenReturn(List.of());

        assertThatThrownBy(() -> handler.handle(msg("r", null, row().put("host_id", 100)), null))
                .isInstanceOf(IllegalStateException.class);
        handler.handle(msg("r", null, row().put("host_id", 100)), null);

        verify(fleetHostSoftwareCache, times(2)).hostSoftware("t1", 100L, String.valueOf(COMMIT_TS));
        verify(projectionTrigger).titlesChanged(eq("t1"), any());
    }

    @Test
    void handle_snapshotReadsOfAnUnresolvedHost_lookUpTheHostOnce() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(false);

        handler.handle(msg("r", null, row().put("host_id", 100).put("software_id", 1)), null);
        handler.handle(msg("r", null, row().put("host_id", 100).put("software_id", 2)), null);
        handler.handle(msg("r", null, row().put("host_id", 100).put("software_id", 3)), null);

        verify(fleetHostResolver, times(1)).isResolvable("100");
        verifyNoInteractions(fleetHostSoftwareCache, deviceSoftwareRepository, projectionTrigger);
    }

    @Test
    void handle_changeEventOfAHostUnresolvedInTheSnapshot_isResolvedAgain() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(false, true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));

        handler.handle(msg("r", null, row().put("host_id", 100)), null);
        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        verify(fleetHostResolver, times(2)).isResolvable("100");
        verify(fleetHostSoftwareCache).hostSoftware("t1", 100L, String.valueOf(COMMIT_TS));
    }

    @Test
    void handle_changeEventsAfterASnapshotRead_alwaysReconcile() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));

        handler.handle(msg("r", null, row().put("host_id", 100)), null);
        handler.handle(msgAt("u", row().put("host_id", 100), row().put("host_id", 100), COMMIT_TS + 1), null);
        handler.handle(msgAt("c", null, row().put("host_id", 100), COMMIT_TS + 2), null);
        handler.handle(msgAt("d", row().put("host_id", 100), null, COMMIT_TS + 3), null);

        verify(fleetHostSoftwareCache).hostSoftware("t1", 100L, String.valueOf(COMMIT_TS));
        verify(fleetHostSoftwareCache).hostSoftware("t1", 100L, String.valueOf(COMMIT_TS + 1));
        verify(fleetHostSoftwareCache).hostSoftware("t1", 100L, String.valueOf(COMMIT_TS + 2));
        verify(fleetHostSoftwareCache).hostSoftware("t1", 100L, String.valueOf(COMMIT_TS + 3));
    }

    @Test
    void handle_changeEventsOfOneCommit_reconcileTheHostOnce() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));

        handler.handle(msg("c", null, row().put("host_id", 100).put("software_id", 1)), null);
        handler.handle(msg("u", row().put("host_id", 100).put("software_id", 2), row().put("host_id", 100).put("software_id", 2)), null);
        handler.handle(msg("d", row().put("host_id", 100).put("software_id", 3), null), null);
        handler.handle(msg("c", null, row().put("host_id", 100).put("software_id", 4)), null);

        verify(fleetHostResolver, times(1)).resolve("100");
        verify(fleetHostSoftwareCache, times(1)).hostSoftware("t1", 100L, String.valueOf(COMMIT_TS));
        verify(deviceSoftwareRepository, times(1)).findByTenantIdAndMachineId("t1", "m1");
        verify(projectionTrigger, times(1)).titlesChanged(eq("t1"), any());
        verify(projectionTrigger, times(1)).cvesChanged(eq("t1"), any());
    }

    @Test
    void handle_oneCommitOnTwoHosts_reconcilesEachHost() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.isResolvable("101")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetHostResolver.resolve("101")).thenReturn(new FleetHostRef("t1", "m2"));

        handler.handle(msg("c", null, row().put("host_id", 100)), null);
        handler.handle(msg("c", null, row().put("host_id", 101)), null);
        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        verify(fleetHostSoftwareCache, times(1)).hostSoftware("t1", 100L, String.valueOf(COMMIT_TS));
        verify(fleetHostSoftwareCache, times(1)).hostSoftware("t1", 101L, String.valueOf(COMMIT_TS));
    }

    @Test
    void handle_changeEventThatFailed_isReconciledByTheNextRowOfTheCommit() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, String.valueOf(COMMIT_TS)))
                .thenThrow(new IllegalStateException("Fleet 503"))
                .thenReturn(List.of());

        assertThatThrownBy(() -> handler.handle(msg("c", null, row().put("host_id", 100)), null))
                .isInstanceOf(IllegalStateException.class);
        handler.handle(msg("c", null, row().put("host_id", 100)), null);
        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        verify(fleetHostSoftwareCache, times(2)).hostSoftware("t1", 100L, String.valueOf(COMMIT_TS));
        verify(projectionTrigger, times(1)).titlesChanged(eq("t1"), any());
    }

    @Test
    void handle_changeEventOfAnUnresolvedHost_isResolvedByTheNextRowOfTheCommit() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(false, true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));

        handler.handle(msg("c", null, row().put("host_id", 100)), null);
        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        verify(fleetHostResolver, times(2)).isResolvable("100");
        verify(fleetHostSoftwareCache, times(1)).hostSoftware("t1", 100L, String.valueOf(COMMIT_TS));
    }

    @Test
    void handle_changeEventsWithoutACommitTime_alwaysReconcile() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        DeserializedDebeziumMessage first = msg("c", null, row().put("host_id", 100));
        first.getPayload().setSource(null);
        DeserializedDebeziumMessage second = msg("c", null, row().put("host_id", 100));
        second.getPayload().setSource(null);

        handler.handle(first, null);
        handler.handle(second, null);

        verify(fleetHostSoftwareCache, times(2)).hostSoftware("t1", 100L, DeviceSoftwareHandler.NO_COMMIT);
    }

    @Test
    void handle_twoTransactionsOfAHostInOneSecond_reconcileTheHostForEach() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));

        handler.handle(msgIn("u", row().put("host_id", 100), row().put("host_id", 100), COMMIT_TS, GTID_1), null);
        handler.handle(msgIn("c", null, row().put("host_id", 100), COMMIT_TS, GTID_2), null);

        verify(fleetHostSoftwareCache).hostSoftware("t1", 100L, GTID_1);
        verify(fleetHostSoftwareCache).hostSoftware("t1", 100L, GTID_2);
        verify(projectionTrigger, times(2)).titlesChanged(eq("t1"), any());
    }

    @Test
    void handle_rowsOfOneTransaction_reconcileTheHostOnce() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));

        handler.handle(msgIn("c", null, row().put("host_id", 100).put("software_id", 1), COMMIT_TS, GTID_1), null);
        handler.handle(msgIn("c", null, row().put("host_id", 100).put("software_id", 2), COMMIT_TS + 1, GTID_1), null);

        verify(fleetHostSoftwareCache, times(1)).hostSoftware("t1", 100L, GTID_1);
        verify(projectionTrigger, times(1)).titlesChanged(eq("t1"), any());
    }

    @Test
    void handle_blankGtid_isKeyedByTheSourceCommitTime() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));

        handler.handle(msgIn("c", null, row().put("host_id", 100), COMMIT_TS, " "), null);

        verify(fleetHostSoftwareCache).hostSoftware("t1", 100L, String.valueOf(COMMIT_TS));
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
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, String.valueOf(COMMIT_TS))).thenReturn(List.of(chrome));
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

    @ParameterizedTest
    @ValueSource(strings = {"homebrew_packages", "homebrew_casks"})
    void handle_homebrewPackageWithOldVersionsLeftByBrew_onlyTheNewestVersionKept(String source) {
        // setup
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        HostSoftwareTitle libnghttp2 = title(44L, "libnghttp2", source, "1.70.0", "1.68.0", "1.71.0");
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, String.valueOf(COMMIT_TS)))
                .thenReturn(List.of(libnghttp2));
        when(deviceSoftwareRepository.findByTenantIdAndMachineIdAndSoftwareTitleId("t1", "m1", 44L))
                .thenReturn(Optional.empty());
        DeserializedDebeziumMessage message = msg("c", null, row().put("host_id", 100));

        // execution
        handler.handle(message, null);

        // verifications
        verify(deviceSoftwareRepository).save(deviceSoftwareCaptor.capture());
        assertThat(deviceSoftwareCaptor.getValue().getVersions()).containsExactly("1.71.0");
    }

    @Test
    void handle_reconcile_keepsTheWingetIdOfAWingetPackage() {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        HostSoftwareTitle sevenZip = title(43L, "7-Zip", "winget_packages", "24.08");
        sevenZip.getInstalledVersions().get(0).setWingetId("7zip.7zip");
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, String.valueOf(COMMIT_TS))).thenReturn(List.of(sevenZip));
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
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, String.valueOf(COMMIT_TS)))
                .thenReturn(List.of(title(42L, "Slack", "apps", "4.0")));
        when(deviceSoftwareRepository.findByTenantIdAndMachineIdAndSoftwareTitleId("t1", "m1", 42L))
                .thenReturn(Optional.empty());

        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        ArgumentCaptor<DeviceSoftware> captor = ArgumentCaptor.forClass(DeviceSoftware.class);
        verify(deviceSoftwareRepository).save(captor.capture());
        assertThat(captor.getValue().getSystemComponent()).isNull();
        assertThat(captor.getValue().getVendor()).isNull();
    }

    @Test
    void handle_macAppWithInstalledPaths_keepsBundleIdAndSortedAppFileNames() {
        // setup
        HostSoftwareTitle code = app("com.microsoft.VSCode", "/Applications/Visual Studio Code.app",
                "/Users/alice/Applications/Code.app", "/Applications/Visual Studio Code.app", " ");
        stubHostSoftware(code);

        // execution
        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        // verifications
        verify(deviceSoftwareRepository).save(deviceSoftwareCaptor.capture());
        DeviceSoftware saved = deviceSoftwareCaptor.getValue();
        assertThat(saved.getBundleIdentifier()).isEqualTo("com.microsoft.VSCode");
        assertThat(saved.getAppFileNames()).containsExactly("Code", "Visual Studio Code");
        assertThat(saved.getTopLevelApp()).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
            "/Applications/Slack.app, true",
            "/Users/alice/Applications/Slack.app, true",
            "/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app, false",
            "/Users/alice/Applications/Chrome Apps.localized/Gmail.app, false",
            "/Applications/Utilities/Slack.app, false",
            "/Library/Application Support/Slack/Slack.app, false"
    })
    void handle_macAppByItsInstalledPath_topLevelOnlyDirectlyInAnApplicationsFolder(String path, boolean topLevel) {
        // setup
        HostSoftwareTitle slack = app("com.tinyspeck.slackmacgap", path);
        stubHostSoftware(slack);

        // execution
        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        // verifications
        verify(deviceSoftwareRepository).save(deviceSoftwareCaptor.capture());
        assertThat(deviceSoftwareCaptor.getValue().getTopLevelApp()).isEqualTo(topLevel);
    }

    @Test
    void handle_macAppNestedAndTopLevel_topLevel() {
        // setup
        HostSoftwareTitle helper = app("com.example.helper",
                "/Applications/Suite.app/Contents/Helpers/Helper.app", "/Applications/Helper.app");
        stubHostSoftware(helper);

        // execution
        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        // verifications
        verify(deviceSoftwareRepository).save(deviceSoftwareCaptor.capture());
        DeviceSoftware saved = deviceSoftwareCaptor.getValue();
        assertThat(saved.getAppFileNames()).containsExactly("Helper");
        assertThat(saved.getTopLevelApp()).isTrue();
    }

    @ParameterizedTest
    @MethodSource("userApplicationsCopies")
    void handle_macAppByItsInstalledPaths_userApplicationsOnlyWhenNoTopLevelCopyIsOutsideTheUsersFolder(
            String[] installedPaths, boolean userApplicationsOnly) {
        // setup
        HostSoftwareTitle slack = app("com.tinyspeck.slackmacgap", installedPaths);
        stubHostSoftware(slack);

        // execution
        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        // verifications
        verify(deviceSoftwareRepository).save(deviceSoftwareCaptor.capture());
        assertThat(deviceSoftwareCaptor.getValue().getUserApplicationsOnly()).isEqualTo(userApplicationsOnly);
    }

    @Test
    void handle_macAppWithoutInstalledPaths_topLevelAndUserApplicationsUnknownAndNoAppFileNames() {
        // setup
        HostSoftwareTitle slack = app("com.tinyspeck.slackmacgap");
        stubHostSoftware(slack);

        // execution
        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        // verifications
        verify(deviceSoftwareRepository).save(deviceSoftwareCaptor.capture());
        DeviceSoftware saved = deviceSoftwareCaptor.getValue();
        assertThat(saved.getBundleIdentifier()).isEqualTo("com.tinyspeck.slackmacgap");
        assertThat(saved.getAppFileNames()).isEmpty();
        assertThat(saved.getTopLevelApp()).isNull();
        assertThat(saved.getUserApplicationsOnly()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " "})
    void handle_macAppWithABlankInstalledPath_topLevelUnknownAndNoAppFileNames(String blankPath) {
        // setup
        HostSoftwareTitle slack = app("com.tinyspeck.slackmacgap", blankPath);
        stubHostSoftware(slack);

        // execution
        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        // verifications
        verify(deviceSoftwareRepository).save(deviceSoftwareCaptor.capture());
        DeviceSoftware saved = deviceSoftwareCaptor.getValue();
        assertThat(saved.getAppFileNames()).isEmpty();
        assertThat(saved.getTopLevelApp()).isNull();
    }

    @Test
    void handle_macAppPathThatIsNotAnApp_noAppFileNameAndNotTopLevel() {
        // setup
        HostSoftwareTitle tool = app("com.example.tool", "/usr/local/bin/tool");
        stubHostSoftware(tool);

        // execution
        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        // verifications
        verify(deviceSoftwareRepository).save(deviceSoftwareCaptor.capture());
        DeviceSoftware saved = deviceSoftwareCaptor.getValue();
        assertThat(saved.getAppFileNames()).isEmpty();
        assertThat(saved.getTopLevelApp()).isFalse();
    }

    @Test
    void handle_otherSourceWithBundleIdAndPaths_keepsNoAppKeys() {
        // setup
        HostSoftwareTitle cask = app("com.tinyspeck.slackmacgap", "/Applications/Slack.app");
        cask.setSource("homebrew_packages");
        stubHostSoftware(cask);

        // execution
        handler.handle(msg("c", null, row().put("host_id", 100)), null);

        // verifications
        verify(deviceSoftwareRepository).save(deviceSoftwareCaptor.capture());
        DeviceSoftware saved = deviceSoftwareCaptor.getValue();
        assertThat(saved.getBundleIdentifier()).isNull();
        assertThat(saved.getAppFileNames()).isEmpty();
        assertThat(saved.getTopLevelApp()).isNull();
    }

    private void stubHostSoftware(HostSoftwareTitle hostSoftwareTitle) {
        when(fleetHostResolver.isResolvable("100")).thenReturn(true);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(fleetHostSoftwareCache.hostSoftware("t1", 100L, String.valueOf(COMMIT_TS)))
                .thenReturn(List.of(hostSoftwareTitle));
        when(deviceSoftwareRepository.findByTenantIdAndMachineIdAndSoftwareTitleId("t1", "m1", 42L))
                .thenReturn(Optional.empty());
    }

    private static Stream<Arguments> userApplicationsCopies() {
        return Stream.of(
                Arguments.of(new String[]{"/Users/alice/Applications/Slack.app"}, true),
                Arguments.of(new String[]{"/Users/alice/Applications/Slack.app",
                        "/Users/alice/Applications/Slack.app/Contents/Helpers/Slack Helper.app"}, true),
                Arguments.of(new String[]{"/Applications/Slack.app"}, false),
                Arguments.of(new String[]{"/Applications/Slack.app", "/Users/alice/Applications/Slack.app"}, false),
                Arguments.of(new String[]{"/Users/alice/Applications/Chrome Apps.localized/Gmail.app"}, false));
    }

    private HostSoftwareTitle app(String bundleIdentifier, String... installedPaths) {
        HostSoftwareTitle app = title(42L, "App", "apps", "1.0");
        app.setBundleIdentifier(bundleIdentifier);
        if (installedPaths.length > 0) {
            app.getInstalledVersions().getFirst().setInstalledPaths(List.of(installedPaths));
        }
        return app;
    }
}
