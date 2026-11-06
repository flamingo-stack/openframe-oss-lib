package com.openframe.data.repository.email;

import com.openframe.core.email.BlockedEmailDomainSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;

/**
 * Answers the email domain policy from {@link BlockedEmailDomainRepository}: one point read per asked domain,
 * so an added entry blocks the next signup at once. Fails open on a datastore error, as the
 * policy requires of every source: a database problem never stops a registration by itself.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StoredBlockedEmailDomainSource implements BlockedEmailDomainSource {

    private final BlockedEmailDomainRepository repository;

    @Override
    public boolean isBlocked(String domain) {
        try {
            return repository.existsById(domain);
        } catch (DataAccessException e) {
            log.warn("Blocked email domain lookup failed for '{}', allowing: {}", domain, e.getMessage());
            return false;
        }
    }
}
