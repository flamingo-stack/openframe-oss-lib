package com.openframe.client.aspect;

import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.impl.MachineTagEventServiceImpl;
import com.openframe.kafka.model.KafkaMessage;
import com.openframe.kafka.model.MachinePinotMessage;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class MachineTagEventServiceImplTest {

    private static final String TOPIC = "devices-topic";
    private static final String MACHINE_ID = "m-1";

    @Mock
    private MachineRepository machineRepository;

    @Mock
    private TagAssignmentRepository tagAssignmentRepository;

    @Mock
    private TagRepository tagRepository;

    @Mock
    private OssTenantRetryingKafkaProducer kafkaProducer;

    @Mock
    private TenantIdProvider tenantIdProvider;

    @Captor
    private ArgumentCaptor<KafkaMessage> messageCaptor;

    @InjectMocks
    private MachineTagEventServiceImpl service;

    @Test
    void processMachineSave_directorySummary_publishedByName() {
        // setup
        ReflectionTestUtils.setField(service, "machineEventsTopic", TOPIC);
        Machine machine = machine();
        machine.setDirectorySources(List.of(DirectorySource.MICROSOFT_365));
        machine.setDirectoryUserLink(DirectoryUserLink.SHARED);

        // execution
        service.processMachineSave(machine);

        // verifications
        verify(kafkaProducer).publish(eq(TOPIC), eq(MACHINE_ID), messageCaptor.capture());
        MachinePinotMessage message = (MachinePinotMessage) messageCaptor.getValue();
        assertThat(message)
                .extracting(MachinePinotMessage::getDirectorySources, MachinePinotMessage::getDirectoryUserLink)
                .containsExactly(List.of("MICROSOFT_365"), "SHARED");
    }

    @Test
    void processMachineSave_machineNeverWrittenByTheMatcher_noSourcesAndNone() {
        // setup
        ReflectionTestUtils.setField(service, "machineEventsTopic", TOPIC);
        Machine machine = machine();

        // execution
        service.processMachineSave(machine);

        // verifications
        verify(kafkaProducer).publish(eq(TOPIC), eq(MACHINE_ID), messageCaptor.capture());
        MachinePinotMessage message = (MachinePinotMessage) messageCaptor.getValue();
        assertThat(message)
                .extracting(MachinePinotMessage::getDirectorySources, MachinePinotMessage::getDirectoryUserLink)
                .containsExactly(List.of(), "NONE");
    }

    private static Machine machine() {
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        return machine;
    }
}
