package com.openframe.data.service.presence;

import com.openframe.data.repository.presence.UserPresenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserPresenceService {

    private final UserPresenceRepository presenceRepository;

    public void markPresent(String userId) {
        presenceRepository.markPresent(userId);
    }

    public boolean isPresentCurrently(String userId) {
        return presenceRepository.isPresent(userId);
    }

    public Optional<Instant> findLastPresenceTime(String userId) {
        return presenceRepository.findLastSeen(userId);
    }
}
