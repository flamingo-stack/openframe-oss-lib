package com.openframe.client.listener;

import com.openframe.client.service.MachineOsInfoService;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import io.nats.client.Connection;
import io.nats.client.Message;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineOsInfoListenerTest {

    private static final String MACHINE_ID = "m-42";
    private static final String SUBJECT = "machine.m-42.os-info";
    private static final String OS_VERSION = "13.6.1";
    private static final String OS_BUILD = "22G313";
    private static final String PAYLOAD = "{\"osVersion\":\"13.6.1\",\"osBuild\":\"22G313\"}";

    @Mock private Connection natsConnection;
    @Mock private MachineOsInfoService machineOsInfoService;
    @Mock private Message message;

    private MachineOsInfoListener listener;

    @BeforeEach
    void setUp() {
        listener = new MachineOsInfoListener(natsConnection, new JsonMapper(), machineOsInfoService,
                new NatsTopicMachineIdExtractor());
    }

    @Test
    void getStreamName_osInfoStream() {
        // setup

        // execution
        String stream = listener.getStreamName();

        // verifications
        assertThat(stream).isEqualTo("MACHINE_OS_INFO");
    }

    @Test
    void getSubject_everyMachinesOsInfo() {
        // setup

        // execution
        String subject = listener.getSubject();

        // verifications
        assertThat(subject).isEqualTo("machine.*.os-info");
    }

    @Test
    void getConsumerName_versionedProcessorName() {
        // setup

        // execution
        String consumer = listener.getConsumerName();

        // verifications
        assertThat(consumer).isEqualTo("machine-os-info-processor-v1");
    }

    @Test
    void getDeliveryGroup_osInfoGroup() {
        // setup

        // execution
        String group = listener.getDeliveryGroup();

        // verifications
        assertThat(group).isEqualTo("machine-os-info");
    }

    @Test
    void getDeliverySubject_osInfoDeliverySubject() {
        // setup

        // execution
        String deliverySubject = listener.getDeliverySubject();

        // verifications
        assertThat(deliverySubject).isEqualTo("machine.os-info.delivery");
    }

    @Test
    void handleMessage_validPayload_serviceCalledWithTheMachineIdFromTheSubject() {
        // setup
        stubMessage(SUBJECT, PAYLOAD);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(machineOsInfoService).updateOsInfo(MACHINE_ID, OS_VERSION, OS_BUILD);
    }

    @Test
    void handleMessage_validPayload_acked() {
        // setup
        stubMessage(SUBJECT, PAYLOAD);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(message).ack();
    }

    @Test
    void handleMessage_payloadWithoutBuild_serviceCalledWithNullBuild() {
        // setup
        stubMessage(SUBJECT, "{\"osVersion\":\"13.6.1\"}");

        // execution
        listener.handleMessage(message);

        // verifications
        verify(machineOsInfoService).updateOsInfo(MACHINE_ID, OS_VERSION, null);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"osVersion\":\"\"}", "{\"osVersion\":\" \",\"osBuild\":\"22G313\"}"})
    void handleMessage_blankVersion_ackedWithoutServiceCall(String payload) {
        // setup
        stubMessage(SUBJECT, payload);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(message).ack();
        verifyNoInteractions(machineOsInfoService);
    }

    @Test
    void handleMessage_malformedJson_ackedAndDropped() {
        // setup
        stubMessage(SUBJECT, "not-json");

        // execution
        listener.handleMessage(message);

        // verifications
        verify(message).ack();
        verifyNoInteractions(machineOsInfoService);
    }

    @Test
    void handleMessage_subjectWithoutMachineId_ackedAndDropped() {
        // setup
        stubMessage("bogus-subject", PAYLOAD);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(message).ack();
        verifyNoInteractions(machineOsInfoService);
    }

    @Test
    void handleMessage_serviceRejectsTheArguments_ackedAndDropped() {
        // setup
        stubMessage(SUBJECT, PAYLOAD);
        doThrow(new IllegalArgumentException("bad version")).when(machineOsInfoService)
                .updateOsInfo(MACHINE_ID, OS_VERSION, OS_BUILD);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(message).ack();
    }

    @Test
    void handleMessage_serviceFailsOtherwise_notAckedForRedelivery() {
        // setup
        stubMessage(SUBJECT, PAYLOAD);
        doThrow(new IllegalStateException("mongo away")).when(machineOsInfoService)
                .updateOsInfo(MACHINE_ID, OS_VERSION, OS_BUILD);

        // execution
        assertThatCode(() -> listener.handleMessage(message)).doesNotThrowAnyException();

        // verifications
        verify(message, never()).ack();
    }

    private void stubMessage(String subject, String payload) {
        when(message.getData()).thenReturn(payload.getBytes(StandardCharsets.UTF_8));
        when(message.getSubject()).thenReturn(subject);
    }
}
