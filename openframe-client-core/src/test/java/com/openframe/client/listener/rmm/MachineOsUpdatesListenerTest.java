package com.openframe.client.listener.rmm;

import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.MachineOsUpdatesService;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import io.nats.client.Connection;
import io.nats.client.Message;
import io.nats.client.impl.NatsJetStreamMetaData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

// The wire format of os-report-contract-draft.md (draft v1) as the listener reads it, and what it acknowledges.
// The fixtures are the contract's two examples and the scenario reports MachineOsUpdatesIngestIT publishes.
@ExtendWith(MockitoExtension.class)
class MachineOsUpdatesListenerTest {

    private static final String SUBJECT = "machine.m-42.os-updates";
    private static final String MACHINE_ID = "m-42";
    private static final Instant STORED_BY_NATS = Instant.parse("2026-11-19T10:15:02.417Z");

    @Mock private Connection natsConnection;
    @Mock private MachineOsUpdatesService osUpdatesService;
    @Mock private Message message;
    @Mock private NatsJetStreamMetaData metaData;
    @Captor private ArgumentCaptor<MachineOsUpdatesMessage> reportCaptor;

    private MachineOsUpdatesListener listener;

    @BeforeEach
    void setUp() {
        listener = new MachineOsUpdatesListener(
                natsConnection, new JsonMapper(), osUpdatesService, new NatsTopicMachineIdExtractor());
    }

    @Test
    void streamAndSubject_areTheOnesTheAgentPublishesOn() {
        // setup

        // execution
        String stream = listener.getStreamName();
        String subject = listener.getSubject();

        // verifications
        assertThat(MachineOsUpdatesMessage.STREAM).isEqualTo("MACHINE_OS_UPDATES");
        assertThat(MachineOsUpdatesMessage.SUBJECT_FILTER).isEqualTo("machine.*.os-updates");
        assertThat(stream).isEqualTo("MACHINE_OS_UPDATES");
        assertThat(subject).isEqualTo("machine.*.os-updates");
    }

    @Test
    void handleMessage_windowsExampleOfTheContract_appliedWithTheTimeNatsStoredIt_andAcked() {
        // setup
        stubMessage(fixture("windows-first-report"));

        // execution
        listener.handleMessage(message);

        // verifications
        verify(osUpdatesService).apply(eq(MACHINE_ID), reportCaptor.capture(), eq(STORED_BY_NATS));
        MachineOsUpdatesMessage report = reportCaptor.getValue();
        MachineOsUpdatesMessage.OsState osState = report.getOsState();
        assertThat(osState.getOsVersion()).isEqualTo("Windows 11 Pro");
        assertThat(osState.getOsBuild()).isEqualTo("26100.4061");
        assertThat(osState.getRestartPending()).isFalse();
        assertThat(osState.getLastScanAt()).isEqualTo(Instant.parse("2026-11-19T10:14:51Z"));
        assertThat(osState.getLastScanError()).isNull();
        assertThat(osState.getManagementState()).hasToString("MANAGED");
        assertThat(osState.getManagedElsewhereReason()).isNull();
        assertThat(osState.getObservedReason()).isNull();
        assertThat(osState.getOsUpdateAuthorization()).hasToString("NOT_REQUIRED");
        assertThat(report.getPendingUpdates()).singleElement().satisfies(update -> {
            assertThat(update.getUpdateKey()).isEqualTo("7d2f1c0e-3b0a-4c59-9d53-0c8f4d1f6a21:201");
            assertThat(update.getTitle())
                    .isEqualTo("2026-11 Cumulative Update for Windows 11 Version 24H2 for x64-based Systems (KB5068861)");
            assertThat(update.getVersion()).isNull();
            assertThat(update.getKbArticleIds()).containsExactly("5068861");
            assertThat(update.getMsrcSeverity()).as("the OS string, mapped by the service").isEqualTo("Critical");
            assertThat(update.getCategories()).singleElement().satisfies(category -> {
                assertThat(category.getId()).isEqualTo("0fa1201d-4330-4fa8-8ae9-b877473b6441");
                assertThat(category.getName()).isEqualTo("Security Updates");
            });
            assertThat(update.getBrowseOnly()).isFalse();
            assertThat(update.getPublishedAt()).isEqualTo(Instant.parse("2026-11-10T18:00:00Z"));
            assertThat(update.getSizeBytes()).isEqualTo(812646400L);
            assertThat(update.getRestartBehaviour()).hasToString("ALWAYS");
        });
        assertThat(report.getInstallHistory()).singleElement().satisfies(entry -> {
            assertThat(entry.getUpdateKey()).isEqualTo("b0a7e1d4-52c3-4f0e-8a6d-91f3c2e4d7aa:200");
            assertThat(entry.getTitle())
                    .isEqualTo("2026-10 Cumulative Update for Windows 11 Version 24H2 for x64-based Systems (KB5066835)");
            assertThat(entry.getInstalledAt()).isEqualTo(Instant.parse("2026-10-16T02:41:10Z"));
            assertThat(entry.getOperation()).hasToString("INSTALL");
            assertThat(entry.getResult()).hasToString("SUCCEEDED");
            assertThat(entry.getHresult()).isEqualTo("0x00000000");
        });
        verify(message).ack();
    }

    @Test
    void handleMessage_macExampleOfTheContract_fieldsTheMacDoesNotSendStayNull() {
        // setup
        stubMessage(fixture("mac-not-authorized"));

        // execution
        listener.handleMessage(message);

        // verifications
        verify(osUpdatesService).apply(eq(MACHINE_ID), reportCaptor.capture(), eq(STORED_BY_NATS));
        MachineOsUpdatesMessage report = reportCaptor.getValue();
        assertThat(report.getOsState().getOsVersion()).isEqualTo("26.2");
        assertThat(report.getOsState().getOsBuild()).isEqualTo("25C56");
        assertThat(report.getOsState().getOsUpdateAuthorization()).hasToString("NOT_AUTHORIZED");
        assertThat(report.getPendingUpdates()).singleElement().satisfies(update -> {
            assertThat(update.getUpdateKey()).isEqualTo("MSU_UPDATE_25G342_patch_26.7.3_minor");
            assertThat(update.getVersion()).isEqualTo("26.7.3");
            assertThat(update.getSizeBytes()).as("above the int range").isEqualTo(3481600000L);
            assertThat(update.getKbArticleIds()).isNull();
            assertThat(update.getMsrcSeverity()).isNull();
            assertThat(update.getCategories()).isNull();
            assertThat(update.getPublishedAt()).isNull();
        });
        assertThat(report.getInstallHistory()).isEmpty();
        verify(message).ack();
    }

    // contract §2: an absent list is "no list in this report", an empty one is "nothing pending"
    @Test
    void handleMessage_failedScanWithoutLists_listsAreNullNotEmpty() {
        // setup
        stubMessage(fixture("windows-failed-scan"));

        // execution
        listener.handleMessage(message);

        // verifications
        verify(osUpdatesService).apply(eq(MACHINE_ID), reportCaptor.capture(), eq(STORED_BY_NATS));
        assertThat(reportCaptor.getValue().getOsState().getLastScanError()).isEqualTo("0x80072EE2");
        assertThat(reportCaptor.getValue().getPendingUpdates()).isNull();
        assertThat(reportCaptor.getValue().getInstallHistory()).isNull();
        verify(message).ack();
    }

    @Test
    void handleMessage_installedReportWithAnEmptyList_listIsEmptyNotNull() {
        // setup
        stubMessage(fixture("windows-installed"));

        // execution
        listener.handleMessage(message);

        // verifications
        verify(osUpdatesService).apply(eq(MACHINE_ID), reportCaptor.capture(), eq(STORED_BY_NATS));
        assertThat(reportCaptor.getValue().getPendingUpdates()).isNotNull().isEmpty();
        assertThat(reportCaptor.getValue().getOsState().getRestartPending()).isTrue();
        assertThat(reportCaptor.getValue().getInstallHistory()).hasSize(2);
    }

    // contract §6.5: a missing boolean is unknown, not false
    @Test
    void handleMessage_booleansAbsent_readAsNull() {
        // setup
        stubMessage("{\"osState\":{\"osVersion\":\"26.2\",\"osBuild\":\"25C56\"},"
                + "\"pendingUpdates\":[{\"updateKey\":\"k-1\",\"title\":\"Update one\"}]}");

        // execution
        listener.handleMessage(message);

        // verifications
        verify(osUpdatesService).apply(eq(MACHINE_ID), reportCaptor.capture(), eq(STORED_BY_NATS));
        assertThat(reportCaptor.getValue().getOsState().getRestartPending()).isNull();
        assertThat(reportCaptor.getValue().getPendingUpdates().getFirst().getBrowseOnly()).isNull();
        verify(message).ack();
    }

    // contract §6.3 and §6.4: an unknown enum value or field does not drop the report
    @Test
    void handleMessage_unknownEnumValuesAndFields_reportApplied_thoseEnumsNull() {
        // setup
        stubMessage("{\"osState\":{\"osVersion\":\"26.2\",\"osBuild\":\"25C56\",\"architecture\":\"RISCV64\","
                + "\"managementState\":\"QUARANTINED\",\"managedElsewhereReason\":\"INTUNE\","
                + "\"observedReason\":\"KIOSK\",\"osUpdateAuthorization\":\"PENDING\",\"fieldOfALaterAgent\":7},"
                + "\"pendingUpdates\":[{\"updateKey\":\"k-1\",\"title\":\"Update one\",\"restartBehaviour\":\"SOMETIMES\"}],"
                + "\"installHistory\":[{\"title\":\"Update zero\",\"installedAt\":\"2026-10-16T02:41:10Z\","
                + "\"operation\":\"REPAIR\",\"result\":\"PENDING_RESTART\"}],"
                + "\"blockOfALaterAgent\":{}}");

        // execution
        listener.handleMessage(message);

        // verifications
        verify(osUpdatesService).apply(eq(MACHINE_ID), reportCaptor.capture(), eq(STORED_BY_NATS));
        MachineOsUpdatesMessage report = reportCaptor.getValue();
        assertThat(report.getOsState().getOsVersion()).isEqualTo("26.2");
        assertThat(report.getOsState().getManagementState()).isNull();
        assertThat(report.getOsState().getManagedElsewhereReason()).isNull();
        assertThat(report.getOsState().getObservedReason()).isNull();
        assertThat(report.getOsState().getOsUpdateAuthorization()).isNull();
        assertThat(report.getPendingUpdates().getFirst().getRestartBehaviour()).isNull();
        assertThat(report.getInstallHistory().getFirst().getOperation()).isNull();
        assertThat(report.getInstallHistory().getFirst().getResult()).isNull();
        assertThat(report.getInstallHistory().getFirst().getUpdateKey()).isNull();
        verify(message).ack();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"osState\": \"x\"",
            "not json",
            "",
            "[]",
            "{\"osState\": \"x\"}",
            "{\"osState\":{\"lastScanAt\":\"yesterday\"}}",
            // osState is required (contract §2): a report without it carries nothing to apply
            "{}",
            "{\"pendingUpdates\":[]}"
    })
    void handleMessage_malformedReport_ackedWithoutApply(String payload) {
        // setup
        stubMessage(payload);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(osUpdatesService, never()).apply(anyString(), any(), any());
        verify(message).ack();
    }

    @Test
    void handleMessage_subjectWithoutAMachineId_ackedWithoutApply() {
        // setup
        stubMessage(fixture("windows-first-report"));
        lenient().when(message.getSubject()).thenReturn("os-updates");

        // execution
        listener.handleMessage(message);

        // verifications
        verify(osUpdatesService, never()).apply(anyString(), any(), any());
        verify(message).ack();
    }

    @Test
    void handleMessage_serviceFailure_leftUnackedForRedelivery() {
        // setup
        stubMessage(fixture("windows-first-report"));
        doThrow(new RuntimeException("mongo down")).when(osUpdatesService).apply(eq(MACHINE_ID), any(), any());

        // execution
        listener.handleMessage(message);

        // verifications
        verify(message, never()).ack();
    }

    private void stubMessage(String payload) {
        // lenient: a malformed report may be dropped before the listener reads the rest of the message
        lenient().when(message.getSubject()).thenReturn(SUBJECT);
        lenient().when(message.getData()).thenReturn(payload.getBytes(StandardCharsets.UTF_8));
        lenient().when(message.metaData()).thenReturn(metaData);
        lenient().when(metaData.timestamp()).thenReturn(STORED_BY_NATS.atZone(ZoneOffset.UTC));
    }

    private static String fixture(String name) {
        String path = "/os-updates/" + name + ".json";
        try (InputStream in = MachineOsUpdatesListenerTest.class.getResourceAsStream(path)) {
            return new String(Objects.requireNonNull(in, "No fixture " + path).readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
