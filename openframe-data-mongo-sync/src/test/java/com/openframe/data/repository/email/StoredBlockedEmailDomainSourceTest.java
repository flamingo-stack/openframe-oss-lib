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
class StoredBlockedEmailDomainSourceTest {

    @Mock
    private BlockedEmailDomainRepository repository;

    @InjectMocks
    private StoredBlockedEmailDomainSource source;

    @Test
    void isBlocked_answersFromTheCollection() {
        when(repository.existsById("rogue.example")).thenReturn(true);
        when(repository.existsById("fresh.example")).thenReturn(false);

        assertThat(source.isBlocked("rogue.example")).isTrue();
        assertThat(source.isBlocked("fresh.example")).isFalse();
    }

    @Test
    void isBlocked_failsOpenWhenTheDatastoreCannotAnswer() {
        when(repository.existsById("rogue.example")).thenThrow(new DataAccessResourceFailureException("mongo down"));

        assertThat(source.isBlocked("rogue.example")).isFalse();
    }
}
