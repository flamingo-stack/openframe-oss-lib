package com.openframe.management.initializer;

import com.openframe.management.service.NatsStreamManagementService;
import io.nats.client.api.RetentionPolicy;
import io.nats.client.api.StorageType;
import io.nats.client.api.StreamConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// The stream of the device OS report, by its wire names: the agent and the tenant's NATS allow-list use the same.
@ExtendWith(MockitoExtension.class)
class NatsStreamConfigurationInitializerOsUpdatesTest {

    @Mock private NatsStreamManagementService streams;
    @Mock private AdditionalStreamConfigurationProvider additional;
    @InjectMocks private NatsStreamConfigurationInitializer initializer;

    @Test
    void run_osUpdatesStreamSaved_withTheSettingsOfThePackageManagersStream() {
        // setup
        when(additional.provide()).thenReturn(List.of());

        // execution
        initializer.run(null);

        // verifications
        ArgumentCaptor<StreamConfiguration> saved = ArgumentCaptor.forClass(StreamConfiguration.class);
        verify(streams, atLeastOnce()).save(saved.capture());
        Optional<StreamConfiguration> osUpdates = named(saved.getAllValues(), "MACHINE_OS_UPDATES");
        StreamConfiguration packageManagers = named(saved.getAllValues(), "MACHINE_PACKAGE_MANAGERS").orElseThrow();
        assertThat(osUpdates).as("stream MACHINE_OS_UPDATES").isPresent();
        assertThat(osUpdates.get().getSubjects()).containsExactly("machine.*.os-updates");
        assertThat(osUpdates.get().getStorageType()).isEqualTo(StorageType.File)
                .isEqualTo(packageManagers.getStorageType());
        assertThat(osUpdates.get().getRetentionPolicy()).isEqualTo(RetentionPolicy.Limits)
                .isEqualTo(packageManagers.getRetentionPolicy());
        assertThat(osUpdates.get().getMaxAge()).isEqualTo(Duration.ofHours(1)).isEqualTo(packageManagers.getMaxAge());
    }

    private static Optional<StreamConfiguration> named(List<StreamConfiguration> streams, String name) {
        return streams.stream().filter(stream -> name.equals(stream.getName())).findFirst();
    }
}
