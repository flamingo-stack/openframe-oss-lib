package com.openframe.client.listener.rmm;

import com.openframe.client.exception.MalformedDeviceOsReportException;
import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.osupdate.DeviceOsReportFacade;
import com.openframe.client.service.rmm.osupdate.DeviceOsReportOutcome;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.nats.client.Connection;
import io.nats.client.Message;
import io.nats.client.impl.NatsJetStreamMetaData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineOsUpdatesListenerTest {

    private static final String SUBJECT = "machine.m-42.os-updates";
    private static final String SUBJECT_WITHOUT_A_MACHINE_ID = "machine..os-updates";
    private static final String MACHINE_ID = "m-42";
    private static final Instant STORED_BY_NATS = Instant.parse("2026-11-20T09:14:03.120Z");
    private static final byte[] PAYLOAD = "{\"platform\":\"WINDOWS\"}".getBytes(StandardCharsets.UTF_8);

    @Mock private Connection natsConnection;
    @Mock private DeviceOsReportFacade deviceOsReportFacade;
    @Mock private NatsTopicMachineIdExtractor natsTopicMachineIdExtractor;
    @Mock private DeviceOsReportMetrics deviceOsReportMetrics;
    @Mock private Message message;
    @Mock private NatsJetStreamMetaData metaData;

    @InjectMocks private MachineOsUpdatesListener listener;

    private Timer.Sample reportStarted;

    @BeforeEach
    void setUp() {
        reportStarted = Timer.start(new SimpleMeterRegistry());
    }

    @Test
    void streamAndSubject_areTheOnesTheAgentPublishesOn() {
        // setup

        // execution
        List<String> wireNames = List.of(listener.getStreamName(), listener.getSubject());

        // verifications
        assertThat(wireNames).containsExactly("MACHINE_OS_UPDATES", "machine.*.os-updates");
    }

    @Test
    void consumer_oneDurableSharedByEveryPod() {
        // setup

        // execution
        List<String> consumerNames =
                List.of(listener.getConsumerName(), listener.getDeliveryGroup(), listener.getDeliverySubject());

        // verifications
        assertThat(consumerNames)
                .containsExactly("machine-os-updates-processor-v1", "machine-os-updates", "machine.os-updates.delivery");
    }

    @Test
    void handleMessage_report_appliedWithTheMachineOfTheSubjectAndTheTimeNatsStoredIt_thenAcked() {
        // setup
        stubDeliveredReport();
        when(deviceOsReportFacade.applyReport(MACHINE_ID, PAYLOAD, STORED_BY_NATS))
                .thenReturn(DeviceOsReportOutcome.APPLIED);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(deviceOsReportFacade).applyReport(MACHINE_ID, PAYLOAD, STORED_BY_NATS);
        verify(message).ack();
    }

    @Test
    void handleMessage_report_payloadSizeAndTheTimeNatsStoredItRecorded() {
        // setup
        stubDeliveredReport();
        when(deviceOsReportFacade.applyReport(MACHINE_ID, PAYLOAD, STORED_BY_NATS))
                .thenReturn(DeviceOsReportOutcome.APPLIED);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(deviceOsReportMetrics).recordReceived(PAYLOAD.length, STORED_BY_NATS);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceOsReportOutcome.class,
            names = {"APPLIED", "IGNORED_OLDER", "UNKNOWN_MACHINE", "FROZEN_MACHINE"})
    void handleMessage_reportHandledByTheFacade_ackedAndRecordedWithTheOutcomeOfTheFacade(
            DeviceOsReportOutcome outcome) {
        // setup
        stubDeliveredReport();
        when(deviceOsReportFacade.applyReport(MACHINE_ID, PAYLOAD, STORED_BY_NATS)).thenReturn(outcome);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(message).ack();
        verify(deviceOsReportMetrics).recordHandled(reportStarted, outcome);
        verify(deviceOsReportMetrics, never()).recordFailed(any(Exception.class));
    }

    @Test
    void handleMessage_malformedReport_droppedAckedAndRecordedAsMalformedNotAsAFailure() {
        // setup
        stubDeliveredReport();
        when(deviceOsReportFacade.applyReport(MACHINE_ID, PAYLOAD, STORED_BY_NATS))
                .thenThrow(new MalformedDeviceOsReportException("OS report is not readable JSON"));

        // execution
        listener.handleMessage(message);

        // verifications
        verify(message).ack();
        verify(deviceOsReportMetrics).recordHandled(reportStarted, DeviceOsReportOutcome.MALFORMED);
        verify(deviceOsReportMetrics, never()).recordFailed(any(Exception.class));
    }

    @Test
    void handleMessage_subjectWithoutAMachineId_droppedAckedAndRecordedAsMalformedWithoutApplying() {
        // setup
        when(deviceOsReportMetrics.startReport()).thenReturn(reportStarted);
        when(message.getSubject()).thenReturn(SUBJECT_WITHOUT_A_MACHINE_ID);
        when(message.getData()).thenReturn(PAYLOAD);
        when(message.metaData()).thenReturn(metaData);
        when(metaData.timestamp()).thenReturn(STORED_BY_NATS.atZone(ZoneOffset.UTC));
        when(natsTopicMachineIdExtractor.extract(SUBJECT_WITHOUT_A_MACHINE_ID))
                .thenThrow(new IllegalArgumentException("Machine ID is empty in subject: machine..os-updates"));

        // execution
        listener.handleMessage(message);

        // verifications
        verifyNoInteractions(deviceOsReportFacade);
        verify(message).ack();
        verify(deviceOsReportMetrics).recordHandled(reportStarted, DeviceOsReportOutcome.MALFORMED);
        verify(deviceOsReportMetrics, never()).recordFailed(any(Exception.class));
    }

    @ParameterizedTest
    @MethodSource("failuresThatMayPass")
    void handleMessage_reportFailsForAnyOtherReason_notAckedSoNatsDeliversItAgain(RuntimeException failure) {
        // setup
        stubDeliveredReport();
        when(deviceOsReportFacade.applyReport(MACHINE_ID, PAYLOAD, STORED_BY_NATS)).thenThrow(failure);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(deviceOsReportFacade).applyReport(MACHINE_ID, PAYLOAD, STORED_BY_NATS);
        verify(message, never()).ack();
    }

    @ParameterizedTest
    @MethodSource("failuresThatMayPass")
    void handleMessage_reportFailsForAnyOtherReason_failureCountedAndRecordedAsFailed(RuntimeException failure) {
        // setup
        stubDeliveredReport();
        when(deviceOsReportFacade.applyReport(MACHINE_ID, PAYLOAD, STORED_BY_NATS)).thenThrow(failure);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(deviceOsReportMetrics).recordFailed(failure);
        verify(deviceOsReportMetrics).recordHandled(reportStarted, DeviceOsReportOutcome.FAILED);
    }

    @Test
    void handleMessage_illegalArgumentWhileApplyingAReadableReport_notAckedSoNatsDeliversItAgain() {
        // setup
        IllegalArgumentException failure =
                new IllegalArgumentException("refused while saving, the report itself is readable");
        stubDeliveredReport();
        when(deviceOsReportFacade.applyReport(MACHINE_ID, PAYLOAD, STORED_BY_NATS)).thenThrow(failure);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(message, never()).ack();
        verify(deviceOsReportMetrics).recordFailed(failure);
        verify(deviceOsReportMetrics).recordHandled(reportStarted, DeviceOsReportOutcome.FAILED);
    }

    private void stubDeliveredReport() {
        when(deviceOsReportMetrics.startReport()).thenReturn(reportStarted);
        when(message.getSubject()).thenReturn(SUBJECT);
        when(message.getData()).thenReturn(PAYLOAD);
        when(message.metaData()).thenReturn(metaData);
        when(metaData.timestamp()).thenReturn(STORED_BY_NATS.atZone(ZoneOffset.UTC));
        when(natsTopicMachineIdExtractor.extract(SUBJECT)).thenReturn(MACHINE_ID);
    }

    private static Stream<RuntimeException> failuresThatMayPass() {
        return Stream.of(
                new DataAccessResourceFailureException("mongo is down"),
                new IllegalStateException("state not saved"),
                new NullPointerException("unexpected null"));
    }
}
