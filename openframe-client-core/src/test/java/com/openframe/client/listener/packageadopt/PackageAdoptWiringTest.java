package com.openframe.client.listener.packageadopt;

import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.client.listener.packageupdate.PackageUpdateExecutionRecorder;
import com.openframe.client.scheduler.PackageAdoptEngineFailureScheduler;
import com.openframe.data.nats.delivery.PackageAdoptDeliveryFailureReader;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.data.service.TenantIdProvider;
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
            .withBean(MachineDeliveryRepository.class, () -> mock(MachineDeliveryRepository.class))
            .withBean(TenantIdProvider.class, () -> mock(TenantIdProvider.class))
            .withUserConfiguration(PackageAdoptStatusListener.class, PackageAdoptStatusProcessor.class,
                    PackageUpdateExecutionRecorder.class, PackageAdoptDeliveryFailureReader.class,
                    PackageAdoptEngineFailureSweep.class, PackageAdoptEngineFailureScheduler.class);

    @Test
    void softwareOff_nothingOfTheAdoptionRuns() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).doesNotHaveBean(PackageAdoptStatusListener.class);
            assertThat(context).doesNotHaveBean(PackageAdoptStatusProcessor.class);
            assertThat(context).doesNotHaveBean(PackageUpdateExecutionRecorder.class);
            assertThat(context).doesNotHaveBean(PackageAdoptEngineFailureScheduler.class);
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
                    assertThat(context).hasSingleBean(PackageAdoptEngineFailureScheduler.class);
                });
    }
}
