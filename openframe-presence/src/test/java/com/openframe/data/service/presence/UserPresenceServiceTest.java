package com.openframe.data.service.presence;

import com.openframe.data.repository.presence.UserPresenceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserPresenceServiceTest {

    @Mock
    private UserPresenceRepository presenceRepository;

    @InjectMocks
    private UserPresenceService service;

    @Test
    void mark_present_delegates_to_the_repository() {
        service.markPresent("user-1");

        verify(presenceRepository).markPresent("user-1");
    }

    @Test
    void is_present_currently_reflects_the_repository() {
        when(presenceRepository.isPresent("user-1")).thenReturn(true);

        assertTrue(service.isPresentCurrently("user-1"));
        assertFalse(service.isPresentCurrently("user-2"));
    }

    @Test
    void find_last_presence_time_returns_the_stored_instant() {
        Instant lastSeen = Instant.ofEpochMilli(1_700_000_000_000L);
        when(presenceRepository.findLastSeen("user-1")).thenReturn(Optional.of(lastSeen));

        assertEquals(Optional.of(lastSeen), service.findLastPresenceTime("user-1"));
    }

    @Test
    void find_last_presence_time_is_empty_for_an_absent_user() {
        when(presenceRepository.findLastSeen("user-1")).thenReturn(Optional.empty());

        assertEquals(Optional.empty(), service.findLastPresenceTime("user-1"));
    }
}
