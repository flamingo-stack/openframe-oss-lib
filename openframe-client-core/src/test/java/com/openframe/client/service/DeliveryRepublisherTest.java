package com.openframe.client.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.rmm.watchdog.DeliveryRepublisher;
import com.openframe.client.service.rmm.watchdog.DeliveryRepublisherRegistry;
import com.openframe.client.service.rmm.watchdog.ScheduleDeliveryRepublisher;
import com.openframe.client.service.rmm.watchdog.SoftwareDeliveryRepublisher;
import com.openframe.data.document.rmm.script.DeliveryChannel;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.rmm.publisher.ScriptScheduleNatsPublisher;
import com.openframe.data.nats.rmm.publisher.SoftwareNatsPublisher;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class DeliveryRepublisherTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ScriptScheduleNatsPublisher scheduleNats = mock(ScriptScheduleNatsPublisher.class);
    private final SoftwareNatsPublisher softwareNats = mock(SoftwareNatsPublisher.class);

    private final ScheduleDeliveryRepublisher schedule = new ScheduleDeliveryRepublisher(objectMapper, scheduleNats);
    private final SoftwareDeliveryRepublisher software = new SoftwareDeliveryRepublisher(objectMapper, softwareNats);

    @Test
    @DisplayName("software republisher: deserializes a ScriptMessage and re-sends it on the software pipe")
    void software_republishesOnSoftwarePipe() throws Exception {
        String json = objectMapper.writeValueAsString(ScriptMessage.builder()
                .executionId("exec-1").scriptId("__software__brew-install").machineId("m-1").build());

        software.republish("m-1", json);

        verify(softwareNats).publishSoftware(eq("m-1"),
                argThat(m -> "exec-1".equals(m.getExecutionId()) && "__software__brew-install".equals(m.getScriptId())));
    }

    @Test
    @DisplayName("schedule republisher: deserializes a ScriptScheduleExecutionMessage and re-sends it on the schedule pipe")
    void schedule_republishesOnSchedulePipe() throws Exception {
        String json = objectMapper.writeValueAsString(ScriptScheduleExecutionMessage.builder()
                .executionId("exec-1").scheduleId("sch-1").machineId("m-1").build());

        schedule.republish("m-1", json);

        verify(scheduleNats).publish(eq("m-1"), argThat(m -> "exec-1".equals(m.getExecutionId())));
    }

    @Test
    @DisplayName("registry routes each channel to its republisher; an unmapped channel is a hard error")
    void registry_routesByChannel() {
        DeliveryRepublisherRegistry registry = new DeliveryRepublisherRegistry(List.of(schedule, software));

        assertThat(registry.get(DeliveryChannel.SCHEDULE)).isSameAs(schedule);
        assertThat(registry.get(DeliveryChannel.SOFTWARE)).isSameAs(software);

        DeliveryRepublisher onlySchedule = schedule;
        DeliveryRepublisherRegistry partial = new DeliveryRepublisherRegistry(List.of(onlySchedule));
        assertThatThrownBy(() -> partial.get(DeliveryChannel.SOFTWARE))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("registry rejects duplicate republishers for the same channel")
    void registry_rejectsDuplicates() {
        assertThatThrownBy(() -> new DeliveryRepublisherRegistry(
                List.of(schedule, new ScheduleDeliveryRepublisher(objectMapper, scheduleNats))))
                .isInstanceOf(IllegalStateException.class);
    }
}
