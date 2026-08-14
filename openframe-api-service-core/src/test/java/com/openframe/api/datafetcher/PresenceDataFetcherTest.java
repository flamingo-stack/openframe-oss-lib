package com.openframe.api.datafetcher;

import com.openframe.core.exception.UnauthorizedException;
import com.openframe.data.service.presence.UserPresenceService;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class PresenceDataFetcherTest {

    @Mock
    private UserPresenceService presenceService;

    @InjectMocks
    private PresenceDataFetcher dataFetcher;

    @Test
    void record_presence_marks_the_caller_present() {
        AuthPrincipal principal = AuthPrincipal.builder()
                .id("user-1")
                .actorType(ActorType.ADMIN)
                .build();

        assertTrue(dataFetcher.recordPresence(principal));

        verify(presenceService).markPresent("user-1");
    }

    @Test
    void agent_principal_is_rejected() {
        AuthPrincipal principal = AuthPrincipal.builder()
                .id("machine-1")
                .actorType(ActorType.AGENT)
                .build();

        assertThrows(UnauthorizedException.class, () -> dataFetcher.recordPresence(principal));

        verifyNoInteractions(presenceService);
    }

    @Test
    void missing_principal_is_rejected() {
        assertThrows(UnauthorizedException.class, () -> dataFetcher.recordPresence(null));

        verifyNoInteractions(presenceService);
    }

    @Test
    void principal_without_user_id_is_rejected() {
        AuthPrincipal principal = AuthPrincipal.builder()
                .actorType(ActorType.ADMIN)
                .build();

        assertThrows(UnauthorizedException.class, () -> dataFetcher.recordPresence(principal));

        verifyNoInteractions(presenceService);
    }
}
