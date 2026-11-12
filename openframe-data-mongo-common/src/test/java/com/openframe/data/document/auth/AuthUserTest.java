package com.openframe.data.document.auth;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuthUserTest {

    @Test
    void getFullName_userHasAName_returnsTheName() {
        AuthUser user = AuthUser.builder().firstName("Anna").lastName("Kowalski").email("anna@acme.com").build();

        assertThat(user.getFullName()).isEqualTo("Anna Kowalski");
    }

    @Test
    void getFullName_userHasNoName_returnsTheEmail() {
        AuthUser user = AuthUser.builder().email("anna@acme.com").build();

        assertThat(user.getFullName()).isEqualTo("anna@acme.com");
    }
}
