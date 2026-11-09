package com.openframe.management.initializer;

import com.openframe.core.exception.NatsException;
import com.openframe.management.service.NatsStreamManagementService;
import io.nats.client.api.StreamConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NatsStreamConfigurationInitializerTest {

    private static final List<String> REMOVED = List.of("TOOL_INSTALLATION", "CLIENT_UPDATE", "CLIENT_UNINSTALL", "TOOL_UPDATE");

    @Mock private NatsStreamManagementService streams;
    @Mock private AdditionalStreamConfigurationProvider additional;
    @InjectMocks private NatsStreamConfigurationInitializer initializer;

    @Test
    void run_removedStreamsAreDeleted_andNeverSaved() {
        // setup
        when(additional.provide()).thenReturn(List.of());

        // execution
        initializer.run(null);

        // verifications
        ArgumentCaptor<StreamConfiguration> saved = ArgumentCaptor.forClass(StreamConfiguration.class);
        verify(streams, atLeastOnce()).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(StreamConfiguration::getName)
                .contains("EXECUTION_ACKNOWLEDGE", "INSTALLED_AGENTS")
                .doesNotContainAnyElementsOf(REMOVED);
        REMOVED.forEach(name -> verify(streams).deleteIfExists(name));
    }

    @Test
    void run_oneDeletionFails_theOthersGoOn_noException() {
        // setup
        when(additional.provide()).thenReturn(List.of());
        doThrow(new NatsException("down", new RuntimeException())).when(streams).deleteIfExists("TOOL_INSTALLATION");

        // execution
        initializer.run(null);

        // verifications
        verify(streams).deleteIfExists("TOOL_UPDATE");
    }
}
