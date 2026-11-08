package com.openframe.data.repository.email;

import com.openframe.core.email.BlockedEmailAddressSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;

/**
 * Answers the email domain policy's address layer from {@link BlockedEmailAddressRepository}: one point read
 * per asked address, so an added entry blocks the next signup at once. Fails open on a datastore error, as
 * the policy requires of every source: a database problem never stops a registration by itself. The address
 * is never logged, only its domain.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StoredBlockedEmailAddressSource implements BlockedEmailAddressSource {

    private final BlockedEmailAddressRepository repository;

    @Override
    public boolean isBlocked(String email) {
        try {
            return repository.existsById(email);
        } catch (DataAccessException e) {
            log.warn("Blocked email address lookup failed for an address on '{}', allowing: {}",
                    domainOf(email), e.getMessage());
            return false;
        }
    }

    private static String domainOf(String email) {
        int at = email == null ? -1 : email.lastIndexOf('@');
        return at < 0 ? "" : email.substring(at + 1);
    }
}
