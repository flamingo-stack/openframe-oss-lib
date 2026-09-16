package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DeliverySpecRegistryTest {

    @Test
    void require_registeredType_specReturned() {
        // setup
        DeliverySpec<?> spec = spec(DeliveryType.TOOL_INSTALLATION);
        ObjectProvider<DeliverySpec<?>> specs = provider(spec);
        DeliverySpecRegistry registry = new DeliverySpecRegistry(specs);

        // execution
        DeliverySpec<?> resolved = registry.require(DeliveryType.TOOL_INSTALLATION);

        // verifications
        assertThat(resolved).isSameAs(spec);
    }

    @Test
    void require_unregisteredType_throwsIllegalArgument() {
        // setup
        ObjectProvider<DeliverySpec<?>> specs = provider();
        DeliverySpecRegistry registry = new DeliverySpecRegistry(specs);

        // execution + verifications
        assertThatThrownBy(() -> registry.require(DeliveryType.CLIENT_UNINSTALL))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("CLIENT_UNINSTALL");
    }

    @Test
    void constructor_duplicateType_throwsIllegalState() {
        // setup
        DeliverySpec<?> first = spec(DeliveryType.TOOL_INSTALLATION);
        DeliverySpec<?> second = spec(DeliveryType.TOOL_INSTALLATION);
        ObjectProvider<DeliverySpec<?>> duplicates = provider(first, second);

        // execution + verifications
        assertThatThrownBy(() -> new DeliverySpecRegistry(duplicates))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("TOOL_INSTALLATION");
    }

    @Test
    void types_twoSpecs_bothTypesListed() {
        // setup
        DeliverySpec<?> install = spec(DeliveryType.TOOL_INSTALLATION);
        DeliverySpec<?> uninstall = spec(DeliveryType.CLIENT_UNINSTALL);
        ObjectProvider<DeliverySpec<?>> specs = provider(install, uninstall);

        // execution
        DeliverySpecRegistry registry = new DeliverySpecRegistry(specs);

        // verifications
        assertThat(registry.types()).containsExactlyInAnyOrder(DeliveryType.TOOL_INSTALLATION, DeliveryType.CLIENT_UNINSTALL);
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<DeliverySpec<?>> provider(DeliverySpec<?>... specs) {
        ObjectProvider<DeliverySpec<?>> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenReturn(Stream.of(specs));
        return provider;
    }

    private static DeliverySpec<?> spec(DeliveryType type) {
        DeliverySpec<?> spec = mock(DeliverySpec.class);
        when(spec.getType()).thenReturn(type);
        return spec;
    }
}
