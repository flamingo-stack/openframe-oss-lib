package com.openframe.core.fleet;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

class FleetEndpointMatcherTest {

    private static final List<String> ENTRIES = List.of(
            "GET /api/{v}/fleet/hosts",
            "GET /api/{v}/fleet/hosts/{id}",
            "GET /api/{v}/fleet/hosts/{id}/software"
    );

    @Test
    void matches_listedMethodAndPath_true() {
        // setup
        FleetEndpointMatcher matcher = new FleetEndpointMatcher(ENTRIES);

        // execution
        boolean matches = matcher.matches(HttpMethod.GET, "/api/v1/fleet/hosts/12");

        // verifications
        assertThat(matches).isTrue();
    }

    @Test
    void matches_latestVersionSegment_true() {
        // setup
        FleetEndpointMatcher matcher = new FleetEndpointMatcher(ENTRIES);

        // execution
        boolean matches = matcher.matches(HttpMethod.GET, "/api/latest/fleet/hosts/12/software");

        // verifications
        assertThat(matches).isTrue();
    }

    @Test
    void matches_methodWithoutEntries_false() {
        // setup
        FleetEndpointMatcher matcher = new FleetEndpointMatcher(ENTRIES);

        // execution
        boolean matches = matcher.matches(HttpMethod.POST, "/api/v1/fleet/hosts");

        // verifications
        assertThat(matches).isFalse();
    }

    @Test
    void matches_unlistedPath_false() {
        // setup
        FleetEndpointMatcher matcher = new FleetEndpointMatcher(ENTRIES);

        // execution
        boolean matches = matcher.matches(HttpMethod.GET, "/api/v1/fleet/queries");

        // verifications
        assertThat(matches).isFalse();
    }

    @Test
    void matches_emptyEntries_false() {
        // setup
        FleetEndpointMatcher matcher = new FleetEndpointMatcher(List.of());

        // execution
        boolean matches = matcher.matches(HttpMethod.GET, "/api/v1/fleet/hosts");

        // verifications
        assertThat(matches).isFalse();
    }

    @Test
    void matches_nullEntries_false() {
        // setup
        FleetEndpointMatcher matcher = new FleetEndpointMatcher(null);

        // execution
        boolean matches = matcher.matches(HttpMethod.GET, "/api/v1/fleet/hosts");

        // verifications
        assertThat(matches).isFalse();
    }

    @Test
    void constructor_malformedEntry_throwsIllegalArgument() {
        // setup
        List<String> entries = List.of("/api/{v}/fleet/hosts");

        // execution
        Throwable thrown = catchThrowable(() -> new FleetEndpointMatcher(entries));

        // verifications
        assertThat(thrown)
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("/api/{v}/fleet/hosts");
    }

    @Test
    void matches_lowercaseMethodInEntry_parsed() {
        // setup
        FleetEndpointMatcher matcher = new FleetEndpointMatcher(List.of("  get   /api/{v}/fleet/hosts"));

        // execution
        boolean matches = matcher.matches(HttpMethod.GET, "/api/v1/fleet/hosts");

        // verifications
        assertThat(matches).isTrue();
    }
}
