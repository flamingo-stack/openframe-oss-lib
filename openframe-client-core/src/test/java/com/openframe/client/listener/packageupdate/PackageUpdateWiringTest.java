package com.openframe.client.listener.packageupdate;

import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import com.openframe.delivery.track.DeliveryTracker;
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
            .withBean(DeliveryTracker.class, () -> mock(DeliveryTracker.class))
            .withBean(MachineRepository.class, () -> mock(MachineRepository.class))
            .withBean(PackageUpdateDeviceStateRepository.class, () -> mock(PackageUpdateDeviceStateRepository.class))
            .withBean(PackageUpdateRequestRepository.class, () -> mock(PackageUpdateRequestRepository.class))
            .withBean(ScriptExecutionRepository.class, () -> mock(ScriptExecutionRepository.class))
            .withUserConfiguration(PackageUpdateStatusListener.class, PackageUpdateStatusProcessor.class,
                    PackageUpdateExecutionRecorder.class, PackageUpdateDeliveryFailureListener.class);

    @Test
    void packageUpdateOff_nothingOfTheFeatureRuns() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).doesNotHaveBean(PackageUpdateStatusListener.class);
            assertThat(context).doesNotHaveBean(PackageUpdateStatusProcessor.class);
            assertThat(context).doesNotHaveBean(PackageUpdateExecutionRecorder.class);
            assertThat(context).doesNotHaveBean(PackageUpdateDeliveryFailureListener.class);
        });
    }

    // the deadline force rides the delivery engine: the feature reads no keys of its own
    @Test
    void packageUpdateOn_noKeysNeeded_allOfItRuns() {
        runner.withPropertyValues("openframe.rmm.software.package-update.enabled=true")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(PackageUpdateStatusListener.class);
                    assertThat(context).hasSingleBean(PackageUpdateStatusProcessor.class);
                    assertThat(context).hasSingleBean(PackageUpdateExecutionRecorder.class);
                    assertThat(context).hasSingleBean(PackageUpdateDeliveryFailureListener.class);
                });
    }
}
