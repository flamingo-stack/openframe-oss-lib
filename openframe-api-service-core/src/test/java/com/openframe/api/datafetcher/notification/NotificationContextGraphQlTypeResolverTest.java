package com.openframe.api.datafetcher.notification;

import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.NotificationContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationContextGraphQlTypeResolverTest {

    private static final NotificationContext ANY = GenericContext.builder().type("any").build();

    @Test
    @DisplayName("Given no resolvers registered, when resolving, then falls back to GenericContext")
    void given_no_resolvers_registered_when_resolving_then_falls_back_to_generic_context() {
        NotificationContextGraphQlTypeResolver dispatcher = new NotificationContextGraphQlTypeResolver(List.of());

        assertThat(dispatcher.resolveType(ANY)).isEqualTo("GenericContext");
    }

    @Test
    @DisplayName("Given every resolver returns null, when resolving, then falls back to GenericContext")
    void given_all_resolvers_return_null_when_resolving_then_falls_back_to_generic_context() {
        NotificationContextGraphQlTypeResolver dispatcher = new NotificationContextGraphQlTypeResolver(
                List.of(source -> null, source -> null));

        assertThat(dispatcher.resolveType(ANY)).isEqualTo("GenericContext");
    }

    @Test
    @DisplayName("Given multiple resolvers, when resolving, then the first non-null answer wins")
    void given_multiple_resolvers_when_resolving_then_first_non_null_wins() {
        NotificationContextGraphQlTypeResolver dispatcher = new NotificationContextGraphQlTypeResolver(List.of(
                source -> null,
                source -> "FirstClaimedType",
                source -> "ShouldNeverBeReached"));

        assertThat(dispatcher.resolveType(ANY)).isEqualTo("FirstClaimedType");
    }

    @Test
    @DisplayName("Given a context source, when resolving, then resolvers receive it for inspection")
    void given_a_source_when_resolving_then_resolvers_receive_it_for_inspection() {
        NotificationContext source = GenericContext.builder().type("approval-request").build();
        NotificationContextGraphQlTypeResolver dispatcher = new NotificationContextGraphQlTypeResolver(List.of(
                inspected -> "approval-request".equals(inspected.getType()) ? "Approval" : null));

        assertThat(dispatcher.resolveType(source)).isEqualTo("Approval");
    }
}
