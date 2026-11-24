package com.openframe.client.service.rmm.osupdate;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.client.listener.rmm.MachineOsUpdatesListener;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.osupdate.parser.DeviceOsReportParser;
import com.openframe.data.repository.device.MachineRepository;
import io.nats.client.Connection;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class DeviceOsWiringTest {

    private static final String FLAG = "openframe.rmm.os-update.enabled";

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withBean(Connection.class, () -> mock(Connection.class))
            .withBean(NatsTopicMachineIdExtractor.class, () -> mock(NatsTopicMachineIdExtractor.class))
            .withBean(MachineRepository.class, () -> mock(MachineRepository.class))
            .withBean(DeviceOsReportParser.class, () -> mock(DeviceOsReportParser.class))
            .withBean(DeviceOsStateService.class, () -> mock(DeviceOsStateService.class))
            .withBean(OsUpdateService.class, () -> mock(OsUpdateService.class))
            .withBean(DeviceOsPendingUpdateService.class, () -> mock(DeviceOsPendingUpdateService.class))
            .withBean(DeviceOsUpdateHistoryService.class, () -> mock(DeviceOsUpdateHistoryService.class))
            .withBean(DeviceOsUpdateHistoryLogService.class, () -> mock(DeviceOsUpdateHistoryLogService.class))
            .withBean(DeviceOsReportMetrics.class, () -> mock(DeviceOsReportMetrics.class))
            .withUserConfiguration(MachineOsUpdatesListener.class, DeviceOsReportFacade.class);

    @Test
    void osUpdateFlagAbsent_neitherTheListenerNorTheFacadeRuns() {
        runner.run(context -> assertThat(context)
                .hasNotFailed()
                .doesNotHaveBean(MachineOsUpdatesListener.class)
                .doesNotHaveBean(DeviceOsReportFacade.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {"false", "yes"})
    void osUpdateFlagAnythingButTrue_neitherTheListenerNorTheFacadeRuns(String value) {
        runner.withPropertyValues(FLAG + "=" + value).run(context -> assertThat(context)
                .hasNotFailed()
                .doesNotHaveBean(MachineOsUpdatesListener.class)
                .doesNotHaveBean(DeviceOsReportFacade.class));
    }

    @Test
    void osUpdateFlagOn_listenerAndFacadeRun() {
        runner.withPropertyValues(FLAG + "=true").run(context -> assertThat(context)
                .hasNotFailed()
                .hasSingleBean(MachineOsUpdatesListener.class)
                .hasSingleBean(DeviceOsReportFacade.class));
    }
}
