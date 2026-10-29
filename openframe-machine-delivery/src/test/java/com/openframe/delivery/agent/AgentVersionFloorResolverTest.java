package com.openframe.delivery.agent;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentVersionFloorResolverTest {

    @Mock private OpenFrameClientConfigurationService clientConfigurationService;
    @InjectMocks private AgentVersionFloorResolver resolver;

    @Test
    void flagName_theAgentsSpellingOfTheType() {
        // execution + verifications
        assertThat(AgentVersionFloorResolver.flagName(DeliveryType.CLIENT_UPDATE)).isEqualTo("delivery-client-update");
        assertThat(AgentVersionFloorResolver.flagName(DeliveryType.TOOL_INSTALLATION)).isEqualTo("delivery-tool-installation");
        assertThat(AgentVersionFloorResolver.flagName(DeliveryType.CLIENT_FEATURE_FLAGS)).isEqualTo("delivery-client-feature-flags");
    }

    @Test
    void of_flagOnWithMinVersion_floorAtThatVersion() {
        // setup
        flags(Map.of("delivery-client-uninstall", new ClientFeatureFlag(true, "1.6.0")));

        // execution
        AgentVersionFloor floor = resolver.of(DeliveryType.CLIENT_UNINSTALL);

        // verifications
        assertThat(floor).isEqualTo(new AgentVersionFloor(true, "1.6.0"));
    }

    @Test
    void of_flagOff_closed() {
        // setup
        flags(Map.of("delivery-client-uninstall", new ClientFeatureFlag(false, "1.6.0")));

        // execution
        AgentVersionFloor floor = resolver.of(DeliveryType.CLIENT_UNINSTALL);

        // verifications
        assertThat(floor).isEqualTo(AgentVersionFloor.CLOSED);
    }

    @Test
    void of_noFlagForTheType_everyVersion() {
        // setup
        flags(Map.of("delivery-client-update", new ClientFeatureFlag(true, "1.6.0")));

        // execution
        AgentVersionFloor floor = resolver.of(DeliveryType.CLIENT_UNINSTALL);

        // verifications
        assertThat(floor).isEqualTo(AgentVersionFloor.EVERY_VERSION);
    }

    @Test
    void of_tenantWithoutAConfigurationOrFlags_everyVersion() {
        // setup
        when(clientConfigurationService.find()).thenReturn(Optional.empty());

        // execution + verifications
        assertThat(resolver.of(DeliveryType.CLIENT_UNINSTALL)).isEqualTo(AgentVersionFloor.EVERY_VERSION);

        // setup
        when(clientConfigurationService.find()).thenReturn(Optional.of(OpenFrameClientConfiguration.builder().build()));

        // execution + verifications
        assertThat(resolver.of(DeliveryType.CLIENT_UNINSTALL)).isEqualTo(AgentVersionFloor.EVERY_VERSION);
    }

    private void flags(Map<String, ClientFeatureFlag> flags) {
        OpenFrameClientConfiguration configuration = OpenFrameClientConfiguration.builder().featureFlags(flags).build();
        when(clientConfigurationService.find()).thenReturn(Optional.of(configuration));
    }
}
