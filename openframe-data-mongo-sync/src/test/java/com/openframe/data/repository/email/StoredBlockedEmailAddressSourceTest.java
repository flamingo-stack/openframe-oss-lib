package com.openframe.data.repository.email;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StoredBlockedEmailAddressSourceTest {

    private static final String ADDRESS = "spammer@gmail.com";
    private static final String DATASTORE_ERROR = "mongo down";

    @Mock
    private BlockedEmailAddressRepository repository;

    @InjectMocks
    private StoredBlockedEmailAddressSource source;

    @Test
    void isBlocked_addressInTheCollection_true() {
        // setup
        when(repository.existsById(ADDRESS)).thenReturn(true);

        // execution
        boolean result = source.isBlocked(ADDRESS);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void isBlocked_addressNotInTheCollection_false() {
        // setup
        when(repository.existsById(ADDRESS)).thenReturn(false);

        // execution
        boolean result = source.isBlocked(ADDRESS);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isBlocked_datastoreCannotAnswer_failsOpen() {
        // setup
        DataAccessResourceFailureException failure = new DataAccessResourceFailureException(DATASTORE_ERROR);
        when(repository.existsById(ADDRESS)).thenThrow(failure);

        // execution
        boolean result = source.isBlocked(ADDRESS);

        // verifications
        assertThat(result).isFalse();
    }
}
