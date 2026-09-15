package com.openframe.client.service.rmm.delivery;

import com.openframe.data.document.rmm.delivery.DeliveryKind;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DeliverySpecRegistryTest {

    @Test
    void require_registeredKind_specReturned() {
        // setup
        DeliverySpec<?> spec = spec(DeliveryKind.TOOL_INSTALLATION);
        ObjectProvider<DeliverySpec<?>> specs = provider(spec);
        DeliverySpecRegistry registry = new DeliverySpecRegistry(specs);

        // execution
        DeliverySpec<?> resolved = registry.require(DeliveryKind.TOOL_INSTALLATION);

        // verifications
        assertThat(resolved).isSameAs(spec);
    }

    @Test
    void require_unregisteredKind_throwsIllegalArgument() {
        // setup
        ObjectProvider<DeliverySpec<?>> specs = provider();
        DeliverySpecRegistry registry = new DeliverySpecRegistry(specs);

        // execution + verifications
        assertThatThrownBy(() -> registry.require(DeliveryKind.CLIENT_UNINSTALL))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("CLIENT_UNINSTALL");
    }

    @Test
    void constructor_duplicateKind_throwsIllegalState() {
        // setup
        DeliverySpec<?> first = spec(DeliveryKind.TOOL_INSTALLATION);
        DeliverySpec<?> second = spec(DeliveryKind.TOOL_INSTALLATION);
        ObjectProvider<DeliverySpec<?>> duplicates = provider(first, second);

        // execution + verifications
        assertThatThrownBy(() -> new DeliverySpecRegistry(duplicates))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("TOOL_INSTALLATION");
    }

    @Test
    void kinds_twoSpecs_bothKindsListed() {
        // setup
        DeliverySpec<?> install = spec(DeliveryKind.TOOL_INSTALLATION);
        DeliverySpec<?> uninstall = spec(DeliveryKind.CLIENT_UNINSTALL);
        ObjectProvider<DeliverySpec<?>> specs = provider(install, uninstall);

        // execution
        DeliverySpecRegistry registry = new DeliverySpecRegistry(specs);

        // verifications
        assertThat(registry.kinds()).containsExactlyInAnyOrder(DeliveryKind.TOOL_INSTALLATION, DeliveryKind.CLIENT_UNINSTALL);
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<DeliverySpec<?>> provider(DeliverySpec<?>... specs) {
        ObjectProvider<DeliverySpec<?>> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenReturn(Stream.of(specs));
        return provider;
    }

    private static DeliverySpec<?> spec(DeliveryKind kind) {
        DeliverySpec<?> spec = mock(DeliverySpec.class);
        when(spec.getKind()).thenReturn(kind);
        return spec;
    }
}
