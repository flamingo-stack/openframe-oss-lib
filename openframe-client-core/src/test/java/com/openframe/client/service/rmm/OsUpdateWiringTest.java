package com.openframe.client.service.rmm;

import com.openframe.client.listener.rmm.MachineOsUpdatesListener;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateRepository;
import com.openframe.data.service.machine.MachineWriter;
import io.nats.client.Connection;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class OsUpdateWiringTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withBean(Connection.class, () -> mock(Connection.class))
            .withBean(ObjectMapper.class, () -> JsonMapper.builder().build())
            .withBean(NatsTopicMachineIdExtractor.class, () -> mock(NatsTopicMachineIdExtractor.class))
            .withBean(MachineRepository.class, () -> mock(MachineRepository.class))
            .withBean(MachineWriter.class, () -> mock(MachineWriter.class))
            .withBean(DeviceOsUpdateRepository.class, () -> mock(DeviceOsUpdateRepository.class))
            .withBean(DeviceOsUpdateHistoryRepository.class, () -> mock(DeviceOsUpdateHistoryRepository.class))
            .withUserConfiguration(MachineOsUpdatesListener.class, MachineOsUpdatesService.class,
                    OsUpdateReportMapper.class);

    @Test
    void osUpdateFlagAbsent_nothingOfTheFeatureRuns() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).doesNotHaveBean(MachineOsUpdatesListener.class);
            assertThat(context).doesNotHaveBean(MachineOsUpdatesService.class);
            assertThat(context).doesNotHaveBean(OsUpdateReportMapper.class);
        });
    }

    @Test
    void osUpdateFlagFalse_nothingOfTheFeatureRuns() {
        runner.withPropertyValues("openframe.rmm.os-update.enabled=false")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).doesNotHaveBean(MachineOsUpdatesListener.class);
                    assertThat(context).doesNotHaveBean(MachineOsUpdatesService.class);
                });
    }

    @Test
    void osUpdateFlagOn_allOfItRuns() {
        runner.withPropertyValues("openframe.rmm.os-update.enabled=true")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(MachineOsUpdatesListener.class);
                    assertThat(context).hasSingleBean(MachineOsUpdatesService.class);
                    assertThat(context).hasSingleBean(OsUpdateReportMapper.class);
                });
    }
}
