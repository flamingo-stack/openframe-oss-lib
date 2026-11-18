package com.openframe.client.listener.packageadopt;

import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.client.listener.packageupdate.PackageUpdateExecutionRecorder;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.delivery.track.DeliveryTracker;
import io.nats.client.Connection;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class PackageAdoptWiringTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withBean(Connection.class, () -> mock(Connection.class))
            .withBean(ObjectMapper.class, () -> JsonMapper.builder().build())
            .withBean(NatsTopicMachineIdExtractor.class, () -> mock(NatsTopicMachineIdExtractor.class))
            .withBean(DeliveryTracker.class, () -> mock(DeliveryTracker.class))
            .withBean(MachineRepository.class, () -> mock(MachineRepository.class))
            .withBean(PackageUpdateRequestRepository.class, () -> mock(PackageUpdateRequestRepository.class))
            .withBean(PackageUpdateDeviceStateRepository.class, () -> mock(PackageUpdateDeviceStateRepository.class))
            .withBean(ScriptExecutionRepository.class, () -> mock(ScriptExecutionRepository.class))
            .withUserConfiguration(PackageAdoptStatusListener.class, PackageAdoptStatusProcessor.class,
                    PackageUpdateExecutionRecorder.class);

    @Test
    void softwareOff_nothingOfTheAdoptionRuns() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).doesNotHaveBean(PackageAdoptStatusListener.class);
            assertThat(context).doesNotHaveBean(PackageAdoptStatusProcessor.class);
            assertThat(context).doesNotHaveBean(PackageUpdateExecutionRecorder.class);
        });
    }

    @Test
    void softwareOn_allOfItRunsWithoutAKeyOfItsOwnOrThePackageUpdateKey() {
        runner.withPropertyValues("openframe.rmm.software.enabled=true")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(PackageAdoptStatusListener.class);
                    assertThat(context).hasSingleBean(PackageAdoptStatusProcessor.class);
                    assertThat(context).hasSingleBean(PackageUpdateExecutionRecorder.class);
                });
    }
}
