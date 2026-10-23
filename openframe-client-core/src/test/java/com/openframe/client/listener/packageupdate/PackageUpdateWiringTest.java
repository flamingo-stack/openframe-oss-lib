package com.openframe.client.listener.packageupdate;

import com.openframe.client.scheduler.PackageUpdateClockScheduler;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.PackageUpdateClockService;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import io.nats.client.Connection;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class PackageUpdateWiringTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withPropertyValues("openframe.rmm.software.enabled=true")
            .withBean(Connection.class, () -> mock(Connection.class))
            .withBean(ObjectMapper.class, () -> JsonMapper.builder().build())
            .withBean(NatsTopicMachineIdExtractor.class, () -> mock(NatsTopicMachineIdExtractor.class))
            .withBean(DeliveryDispatcher.class, () -> mock(DeliveryDispatcher.class))
            .withBean(MachineRepository.class, () -> mock(MachineRepository.class))
            .withBean(PackageUpdateDeviceStateRepository.class, () -> mock(PackageUpdateDeviceStateRepository.class))
            .withBean(PackageUpdateRequestRepository.class, () -> mock(PackageUpdateRequestRepository.class))
            .withBean(ScriptExecutionRepository.class, () -> mock(ScriptExecutionRepository.class))
            .withUserConfiguration(PackageUpdateStatusListener.class, DefaultPackageUpdateStatusProcessor.class,
                    PackageUpdateExecutionRecorder.class, PackageUpdateClockService.class,
                    PackageUpdateClockScheduler.class);

    @Test
    void packageUpdateOff_nothingOfTheFeatureRuns_andNoKeysNeeded() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).doesNotHaveBean(PackageUpdateStatusListener.class);
            assertThat(context).doesNotHaveBean(DefaultPackageUpdateStatusProcessor.class);
            assertThat(context).doesNotHaveBean(PackageUpdateExecutionRecorder.class);
            assertThat(context).doesNotHaveBean(PackageUpdateClockService.class);
            assertThat(context).doesNotHaveBean(PackageUpdateClockScheduler.class);
        });
    }

    @Test
    void packageUpdateOn_clockKeysMissing_failsFast() {
        runner.withPropertyValues("openframe.rmm.software.package-update.enabled=true")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void packageUpdateOn_withClockKeys_allOfItRuns() {
        runner.withPropertyValues(
                        "openframe.rmm.software.package-update.enabled=true",
                        "openframe.rmm.software.package-update.deadline.batch-size=500",
                        "openframe.rmm.software.package-update.retry.batch-size=500",
                        "openframe.rmm.software.package-update.retry.max-attempts=3",
                        "openframe.rmm.software.package-update.retry.backoff-seconds=21600")
                .run(context -> {
                    assertThat(context).hasSingleBean(PackageUpdateStatusListener.class);
                    assertThat(context).hasSingleBean(DefaultPackageUpdateStatusProcessor.class);
                    assertThat(context).hasSingleBean(PackageUpdateExecutionRecorder.class);
                    assertThat(context).hasSingleBean(PackageUpdateClockService.class);
                    assertThat(context).hasSingleBean(PackageUpdateClockScheduler.class);
                });
    }
}
