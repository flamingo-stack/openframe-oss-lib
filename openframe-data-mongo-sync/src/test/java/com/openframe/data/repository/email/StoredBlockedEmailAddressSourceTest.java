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

    @Mock
    private BlockedEmailAddressRepository repository;

    @InjectMocks
    private StoredBlockedEmailAddressSource source;

    @Test
    void isBlocked_answersFromTheCollection() {
        when(repository.existsById("spammer@gmail.com")).thenReturn(true);
        when(repository.existsById("someone@gmail.com")).thenReturn(false);

        assertThat(source.isBlocked("spammer@gmail.com")).isTrue();
        assertThat(source.isBlocked("someone@gmail.com")).isFalse();
    }

    @Test
    void isBlocked_failsOpenWhenTheDatastoreCannotAnswer() {
        when(repository.existsById("spammer@gmail.com")).thenThrow(new DataAccessResourceFailureException("mongo down"));

        assertThat(source.isBlocked("spammer@gmail.com")).isFalse();
    }
}
