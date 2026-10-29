package com.openframe.delivery.agent;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryProperties.PolicyOverride;
import com.openframe.delivery.config.DeliveryTestPolicies;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AgentVersionFloorResolverTest {

    private DeliveryProperties properties;
    private AgentVersionFloorResolver resolver;

    @BeforeEach
    void setUp() {
        properties = DeliveryTestPolicies.properties();
        resolver = new AgentVersionFloorResolver(properties);
    }

    @Test
    void of_typeNamesAMinAgentVersion_floorAtThatVersion() {
        // setup
        PolicyOverride uninstall = new PolicyOverride();
        uninstall.setMinAgentVersion("1.6.0");
        properties.setTypes(Map.of(DeliveryType.CLIENT_UNINSTALL, uninstall));

        // execution
        AgentVersionFloor floor = resolver.of(DeliveryType.CLIENT_UNINSTALL);

        // verifications
        assertThat(floor).isEqualTo(new AgentVersionFloor("1.6.0"));
    }

    @Test
    void of_typeWithoutOne_everyVersion() {
        // execution + verifications
        assertThat(resolver.of(DeliveryType.CLIENT_UNINSTALL)).isEqualTo(AgentVersionFloor.EVERY_VERSION);
    }
}
