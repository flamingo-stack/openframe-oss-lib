package com.openframe.data.document.user;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UserTest {

    @Test
    void fullName_firstAndLastName_joinsThemWithASpace() {
        assertThat(user("Anna", "Kowalski").fullName()).isEqualTo("Anna Kowalski");
    }

    @Test
    void fullName_blankFirstName_returnsTheLastNameAlone() {
        assertThat(user(" ", "Kowalski").fullName()).isEqualTo("Kowalski");
    }

    @Test
    void fullName_noName_returnsNull() {
        assertThat(user(null, null).fullName()).isNull();
    }

    @Test
    void nameOrEmail_userHasAName_returnsTheName() {
        User user = User.builder().firstName("Anna").lastName("Kowalski").email("anna@acme.com").build();

        assertThat(user.nameOrEmail()).isEqualTo("Anna Kowalski");
    }

    @Test
    void nameOrEmail_userHasNoName_returnsTheEmail() {
        User user = User.builder().email("anna@acme.com").build();

        assertThat(user.nameOrEmail()).isEqualTo("anna@acme.com");
    }

    private static User user(String firstName, String lastName) {
        return User.builder().firstName(firstName).lastName(lastName).build();
    }
}
