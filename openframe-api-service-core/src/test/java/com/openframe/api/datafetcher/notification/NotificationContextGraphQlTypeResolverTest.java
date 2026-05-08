package com.openframe.api.datafetcher.notification;

import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationContextDescriptor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationContextGraphQlTypeResolverTest {

    private static final NotificationContext ANY = GenericContext.builder().type("any").build();

    @Test
    @DisplayName("Given no descriptors registered, when resolving, then falls back to GenericContext")
    void given_no_descriptors_registered_when_resolving_then_falls_back_to_generic_context() {
        NotificationContextGraphQlTypeResolver dispatcher = new NotificationContextGraphQlTypeResolver(List.of());

        assertThat(dispatcher.resolveType(ANY)).isEqualTo("GenericContext");
    }

    @Test
    @DisplayName("Given a context whose type does not match any descriptor, when resolving, then falls back to GenericContext")
    void given_unknown_type_when_resolving_then_falls_back_to_generic_context() {
        NotificationContextGraphQlTypeResolver dispatcher = new NotificationContextGraphQlTypeResolver(List.of(
                descriptor("known", "KnownType", GenericContext.class)));

        assertThat(dispatcher.resolveType(ANY)).isEqualTo("GenericContext");
    }

    @Test
    @DisplayName("Given a descriptor whose type matches the context, when resolving, then its graphqlTypeName is returned")
    void given_matching_descriptor_when_resolving_then_returns_its_graphql_type_name() {
        NotificationContext source = GenericContext.builder().type("approval-request").build();
        NotificationContextGraphQlTypeResolver dispatcher = new NotificationContextGraphQlTypeResolver(List.of(
                descriptor("approval-request", "Approval", GenericContext.class)));

        assertThat(dispatcher.resolveType(source)).isEqualTo("Approval");
    }

    @Test
    @DisplayName("Given a descriptor with no graphqlTypeName override, when resolving, then the default falls back to contextClass simple name")
    void given_default_graphql_type_name_when_resolving_then_uses_simple_class_name() {
        NotificationContext source = GenericContext.builder().type("plain").build();
        NotificationContextDescriptor descriptor = new NotificationContextDescriptor() {
            @Override public String type() { return "plain"; }
            @Override public Class<? extends NotificationContext> contextClass() { return GenericContext.class; }
        };

        NotificationContextGraphQlTypeResolver dispatcher = new NotificationContextGraphQlTypeResolver(List.of(descriptor));

        assertThat(dispatcher.resolveType(source)).isEqualTo("GenericContext");
    }

    @Test
    @DisplayName("Given two descriptors that share the same type discriminator, when resolving, then the first registered wins — deterministic dedup")
    void given_duplicate_type_descriptors_when_resolving_then_first_wins() {
        NotificationContext source = GenericContext.builder().type("dup").build();
        NotificationContextGraphQlTypeResolver dispatcher = new NotificationContextGraphQlTypeResolver(List.of(
                descriptor("dup", "FirstWins", GenericContext.class),
                descriptor("dup", "ShouldNotWin", GenericContext.class)));

        assertThat(dispatcher.resolveType(source)).isEqualTo("FirstWins");
    }

    private static NotificationContextDescriptor descriptor(String type, String graphqlTypeName,
                                                            Class<? extends NotificationContext> contextClass) {
        return new NotificationContextDescriptor() {
            @Override public String type() { return type; }
            @Override public Class<? extends NotificationContext> contextClass() { return contextClass; }
            @Override public String graphqlTypeName() { return graphqlTypeName; }
        };
    }
}
