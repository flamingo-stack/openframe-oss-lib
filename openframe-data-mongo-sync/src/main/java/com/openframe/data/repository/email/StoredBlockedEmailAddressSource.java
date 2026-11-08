package com.openframe.data.repository.email;

import com.openframe.core.email.BlockedEmailAddressSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;

import static com.openframe.core.email.EmailAddressCanonicalizer.domainOf;

@Slf4j
@Component
@RequiredArgsConstructor
public class StoredBlockedEmailAddressSource implements BlockedEmailAddressSource {

    private final BlockedEmailAddressRepository repository;

    // Fails open: a database problem never stops a registration by itself. Only the domain is logged.
    @Override
    public boolean isBlocked(String canonicalAddress) {
        try {
            return repository.existsById(canonicalAddress);
        } catch (DataAccessException e) {
            log.warn("Blocked email address lookup failed for an address on '{}', allowing", domainOf(canonicalAddress), e);
            return false;
        }
    }
}
