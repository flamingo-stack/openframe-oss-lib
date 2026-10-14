package com.openframe.api.service;

import com.openframe.api.dto.force.request.ForceClientFeatureFlagsRequest;
import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceClientFeatureFlagsResponse;
import com.openframe.api.dto.force.response.ForceClientFeatureFlagsResponseItem;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientFeatureFlagsDeliverySeed;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import com.openframe.delivery.spec.DeliveryAudience;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForceClientFeatureFlagsServiceTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String OTHER_MACHINE_ID = "mach-43";
    private static final Map<String, Boolean> FLAGS = Map.of("delivery-tool-installation", true);

    @Mock private OpenFrameClientConfigurationService clientConfigurationService;
    @Mock private DeliveryProperties deliveryProperties;
    @Mock private DeliveryDispatcher deliveryDispatcher;
    @Captor private ArgumentCaptor<ClientFeatureFlagsDeliverySeed> seedCaptor;
    @InjectMocks private ForceClientFeatureFlagsService service;

    private ForceClientFeatureFlagsRequest request;

    @BeforeEach
    void setUp() {
        request = new ForceClientFeatureFlagsRequest();
        request.setMachineIds(List.of(MACHINE_ID, OTHER_MACHINE_ID));
    }

    @Test
    void process_typeOnTheEngine_currentFlagsHandedToEachMachine() {
        // setup
        when(deliveryProperties.isEnabled(DeliveryType.CLIENT_FEATURE_FLAGS)).thenReturn(true);
        when(clientConfigurationService.get()).thenReturn(OpenFrameClientConfiguration.builder().featureFlags(FLAGS).build());

        // execution
        ForceClientFeatureFlagsResponse response = service.process(request);

        // verifications
        verify(deliveryDispatcher, times(2)).dispatch(seedCaptor.capture());
        List<ClientFeatureFlagsDeliverySeed> seeds = seedCaptor.getAllValues();
        assertThat(seeds).extracting(ClientFeatureFlagsDeliverySeed::getMachineId).containsExactly(MACHINE_ID, OTHER_MACHINE_ID);
        assertThat(seeds).extracting(ClientFeatureFlagsDeliverySeed::getAudience).containsOnly(DeliveryAudience.MACHINE);
        assertThat(seeds).extracting(ClientFeatureFlagsDeliverySeed::getFlags).containsOnly(FLAGS);
        assertThat(response.getItems()).extracting(ForceClientFeatureFlagsResponseItem::getStatus).containsOnly(ForceAgentStatus.PROCESSED);
    }

    @Test
    void process_configurationWithoutFlagsYet_emptySetHandedOver() {
        // setup
        when(deliveryProperties.isEnabled(DeliveryType.CLIENT_FEATURE_FLAGS)).thenReturn(true);
        when(clientConfigurationService.get()).thenReturn(OpenFrameClientConfiguration.builder().build());

        // execution
        service.process(request);

        // verifications
        verify(deliveryDispatcher, times(2)).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue().getFlags()).isEmpty();
    }

    @Test
    void process_oneHandOffFails_thatMachineFailedTheOtherProcessed() {
        // setup
        when(deliveryProperties.isEnabled(DeliveryType.CLIENT_FEATURE_FLAGS)).thenReturn(true);
        when(clientConfigurationService.get()).thenReturn(OpenFrameClientConfiguration.builder().featureFlags(FLAGS).build());
        doThrow(new IllegalStateException("kafka down")).doNothing().when(deliveryDispatcher).dispatch(any());

        // execution
        ForceClientFeatureFlagsResponse response = service.process(request);

        // verifications
        assertThat(response.getItems()).extracting(ForceClientFeatureFlagsResponseItem::getStatus)
                .containsExactly(ForceAgentStatus.FAILED, ForceAgentStatus.PROCESSED);
    }

    @Test
    void process_typeOff_refused() {
        // setup
        when(deliveryProperties.isEnabled(DeliveryType.CLIENT_FEATURE_FLAGS)).thenReturn(false);

        // execution + verifications
        assertThatThrownBy(() -> service.process(request)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(clientConfigurationService, deliveryDispatcher);
    }

    @Test
    void process_noMachines_rejected() {
        // setup
        request.setMachineIds(List.of());

        // execution + verifications
        assertThatThrownBy(() -> service.process(request)).isInstanceOf(IllegalArgumentException.class);
    }
}
