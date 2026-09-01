package com.openframe.management.initializer;

import com.openframe.management.service.NatsStreamManagementService;
import io.nats.client.api.RetentionPolicy;
import io.nats.client.api.StorageType;
import io.nats.client.api.StreamConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class NatsStreamConfigurationInitializer implements ApplicationRunner {

    // TODO: use json file
    // TODO: revise stream configuration
    private static final List<StreamConfiguration> CONFIGURATIONS = List.of(
            // tool installation stream (also carries tool-uninstall on the same stream)
            StreamConfiguration.builder()
                    .name("TOOL_INSTALLATION")
                    .subjects(List.of("machine.*.tool-installation", "machine.*.tool-uninstall"))
                    .storageType(StorageType.File)
                    .retentionPolicy(RetentionPolicy.Limits)
                    .build(),
            // client update stream
            StreamConfiguration.builder()
                    .name("CLIENT_UPDATE")
                    .subjects(List.of("machine.*.client-update"))
                    .storageType(StorageType.File)
                    .retentionPolicy(RetentionPolicy.Limits)
                    .build(),
            // client uninstall stream (the message itself is the command, empty payload)
            StreamConfiguration.builder()
                    .name("CLIENT_UNINSTALL")
                    .subjects(List.of("machine.*.client-uninstall"))
                    .storageType(StorageType.File)
                    .retentionPolicy(RetentionPolicy.Limits)
                    .build(),
            // tool agent update stream
            StreamConfiguration.builder()
                    .name("TOOL_UPDATE")
                    .subjects(List.of("machine.*.tool.*.update"))
                    .storageType(StorageType.File)
                    .retentionPolicy(RetentionPolicy.Limits)
                    .build(),
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
                    .build(),
            StreamConfiguration.builder()
                    .name("EXECUTION_ACKNOWLEDGE")
                    .subjects(List.of("machine.*.execution.acknowledge"))
                    .storageType(StorageType.File)
                    .retentionPolicy(RetentionPolicy.Limits)
                    .build()
    );

    private final NatsStreamManagementService natsStreamManagementService;
    private final AdditionalStreamConfigurationProvider additionalStreamConfigurationProvider;

    @Override
    public void run(ApplicationArguments args) {
        CONFIGURATIONS.forEach(natsStreamManagementService::save);

        additionalStreamConfigurationProvider.provide()
                .forEach(natsStreamManagementService::save);
    }

}
