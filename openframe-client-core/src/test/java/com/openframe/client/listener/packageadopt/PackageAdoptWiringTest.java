package com.openframe.client.listener.packageadopt;

import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareAdoptionRepository;
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
            .withBean(SoftwareAdoptionRepository.class, () -> mock(SoftwareAdoptionRepository.class))
            .withUserConfiguration(PackageAdoptStatusListener.class, PackageAdoptStatusProcessor.class,
                    PackageAdoptDeliveryFailureListener.class);

    @Test
    void softwareOff_nothingOfTheAdoptionRuns() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).doesNotHaveBean(PackageAdoptStatusListener.class);
            assertThat(context).doesNotHaveBean(PackageAdoptStatusProcessor.class);
            assertThat(context).doesNotHaveBean(PackageAdoptDeliveryFailureListener.class);
        });
    }

    @Test
    void softwareOn_allOfItRunsWithoutAKeyOfItsOwn() {
        runner.withPropertyValues("openframe.rmm.software.enabled=true")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(PackageAdoptStatusListener.class);
                    assertThat(context).hasSingleBean(PackageAdoptStatusProcessor.class);
                    assertThat(context).hasSingleBean(PackageAdoptDeliveryFailureListener.class);
                });
    }
}
