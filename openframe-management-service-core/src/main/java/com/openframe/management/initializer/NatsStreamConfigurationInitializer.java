package com.openframe.management.initializer;

import com.openframe.data.nats.delivery.DeliveryResultMessage;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage;
import com.openframe.data.nats.rmm.model.MachinePackageManagersMessage;
import com.openframe.management.service.NatsStreamManagementService;
import io.nats.client.api.RetentionPolicy;
import io.nats.client.api.StorageType;
import io.nats.client.api.StreamConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class NatsStreamConfigurationInitializer implements ApplicationRunner {

    // TODO: use json file
    // TODO: revise stream configuration
    private static final List<StreamConfiguration> CONFIGURATIONS = List.of(
            // tool connection stream
            StreamConfiguration.builder()
                    .name("TOOL_CONNECTIONS")
                    .subjects(List.of("machine.*.tool-connection"))
                    .storageType(StorageType.File)
                    .retentionPolicy(RetentionPolicy.Limits)
                    .build(),
            // installed agent stream (machine-scoped and user-scoped subjects)
            StreamConfiguration.builder()
                    .name("INSTALLED_AGENTS")
                    .subjects(List.of("machine.*.installed-agent", "user.*.installed-agent"))
                    .storageType(StorageType.File)
                    .retentionPolicy(RetentionPolicy.Limits)
                    .build(),
            // machine hostname change stream
            StreamConfiguration.builder()
                    .name("MACHINE_HOSTNAME")
                    .subjects(List.of("machine.*.hostname"))
                    .storageType(StorageType.File)
                    .retentionPolicy(RetentionPolicy.Limits)
                    .build(),
            StreamConfiguration.builder()
                    .name("MACHINE_TIMEZONE")
                    .subjects(List.of("machine.*.timezone"))
                    .storageType(StorageType.File)
                    .retentionPolicy(RetentionPolicy.Limits)
                    .maxAge(Duration.ofHours(1))
                    .build(),
            StreamConfiguration.builder()
                    .name("EXECUTION_ACKNOWLEDGE")
                    .subjects(List.of("machine.*.execution.acknowledge"))
                    .storageType(StorageType.File)
                    .retentionPolicy(RetentionPolicy.Limits)
                    .build(),
            StreamConfiguration.builder()
                    .name(DeliveryResultMessage.STREAM)
                    .subjects(List.of(DeliveryResultMessage.SUBJECT_FILTER))
                    .storageType(StorageType.File)
                    .retentionPolicy(RetentionPolicy.Limits)
                    .maxAge(Duration.ofDays(1))
                    .build(),
            StreamConfiguration.builder()
                    .name(MachinePackageManagersMessage.STREAM)
                    .subjects(List.of(MachinePackageManagersMessage.SUBJECT_FILTER))
                    .storageType(StorageType.File)
                    .retentionPolicy(RetentionPolicy.Limits)
                    .maxAge(Duration.ofHours(1))
                    .build(),
            StreamConfiguration.builder()
                    .name(PackageUpdateStatusMessage.STREAM)
                    .subjects(List.of(PackageUpdateStatusMessage.SUBJECT_FILTER))
                    .storageType(StorageType.File)
                    .retentionPolicy(RetentionPolicy.Limits)
                    .maxAge(Duration.ofDays(1))
                    .build()
    );

    // the streams of the path before the delivery engine, on every tenant NATS that ran an older release
    private static final List<String> REMOVED_STREAMS = List.of("TOOL_INSTALLATION", "CLIENT_UPDATE", "CLIENT_UNINSTALL", "TOOL_UPDATE");

    private final NatsStreamManagementService natsStreamManagementService;
    private final AdditionalStreamConfigurationProvider additionalStreamConfigurationProvider;

    @Override
    public void run(ApplicationArguments args) {
        CONFIGURATIONS.forEach(natsStreamManagementService::save);

        additionalStreamConfigurationProvider.provide()
                .forEach(natsStreamManagementService::save);

        REMOVED_STREAMS.forEach(this::deleteRemovedStream);
    }

    // a stream left behind harms nothing and the next start tries again: it must not stop management from starting
    private void deleteRemovedStream(String streamName) {
        try {
            natsStreamManagementService.deleteIfExists(streamName);
        } catch (RuntimeException e) {
            log.error("Removed stream not deleted, the next start tries again: stream={}", streamName, e);
        }
    }

}
