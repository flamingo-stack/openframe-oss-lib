package com.openframe.api.datafetcher;

import com.openframe.api.service.PushDeviceService;
import com.openframe.core.exception.UnauthorizedException;
import com.openframe.data.document.push.PushPlatform;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PushDeviceDataFetcherTest {

    private PushDeviceService service;
    private PushDeviceDataFetcher fetcher;

    @BeforeEach
    void setUp() {
        service = mock(PushDeviceService.class);
        fetcher = new PushDeviceDataFetcher(service);
    }

    @Test
    @DisplayName("registerPushDevice binds the token to the AUTHENTICATED user — the caller cannot register for someone else")
    void register_delegates_with_the_principal_id() {
        when(service.register("user-1", "tok-1", PushPlatform.ANDROID)).thenReturn(true);

        assertThat(fetcher.registerPushDevice("tok-1", PushPlatform.ANDROID, principal("user-1"))).isTrue();
        verify(service).register("user-1", "tok-1", PushPlatform.ANDROID);
    }

    @Test
    @DisplayName("unregisterPushDevice deletes the caller's own token")
    void unregister_delegates_with_the_principal_id() {
        when(service.unregister("user-1", "tok-1")).thenReturn(true);

        assertThat(fetcher.unregisterPushDevice("tok-1", principal("user-1"))).isTrue();
        verify(service).unregister("user-1", "tok-1");
    }

    @Test
    @DisplayName("Given no authenticated user, when registering, then UnauthorizedException — the service is never reached")
    void missing_principal_is_unauthorized() {
        assertThatThrownBy(() -> fetcher.registerPushDevice("tok-1", PushPlatform.IOS, null))
                .isInstanceOf(UnauthorizedException.class);
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("Given an AGENT (machine) principal, when it calls the human-only push mutations, then it is rejected before the service — a machine has no phone")
    void agent_principal_is_rejected() {
        assertThatThrownBy(() -> fetcher.registerPushDevice("tok-1", PushPlatform.ANDROID, agent("machine-7")))
                .isInstanceOf(UnauthorizedException.class);
        assertThatThrownBy(() -> fetcher.unregisterPushDevice("tok-1", agent("machine-7")))
                .isInstanceOf(UnauthorizedException.class);
        verifyNoInteractions(service);
    }

    private static AuthPrincipal principal(String userId) {
        return AuthPrincipal.builder().id(userId).actorType(ActorType.ADMIN).build();
    }

    private static AuthPrincipal agent(String machineId) {
        return AuthPrincipal.builder().id(machineId).actorType(ActorType.AGENT).build();
    }
}
