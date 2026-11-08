package com.openframe.core.email;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

class EmailAddressCanonicalizerTest {

    private static final String DOMAIN = "example.com";
    private static final String PADDED_MIXED_CASE_DOMAIN = "  Example.COM ";
    private static final String PADDED_TAGGED_ADDRESS = " Someone+Tag@Example.COM ";
    private static final String NO_LOCAL_PART_OR_DOMAIN = "needs a local part and a domain";
    private static final String NO_DOMAIN = "has no domain";

    @ParameterizedTest
    @MethodSource("canonicalForms")
    void canonicalAddress_anySpellingOfAMailbox_oneCanonicalForm(String email, String expected) {
        // execution
        String canonical = EmailAddressCanonicalizer.canonicalAddress(email);

        // verifications
        assertThat(canonical).isEqualTo(expected);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"   ", " No-At-Sign ", "trailing@", "@example.com"})
    void canonicalAddress_noLocalPartOrNoDomain_throwsIllegalArgument(String email) {
        // execution
        Throwable thrown = catchThrowable(() -> EmailAddressCanonicalizer.canonicalAddress(email));

        // verifications
        assertThat(thrown)
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(NO_LOCAL_PART_OR_DOMAIN);
    }

    @ParameterizedTest
    @ValueSource(strings = {PADDED_TAGGED_ADDRESS, "@example.com", "first.last@EXAMPLE.com"})
    void domainOf_addressWithADomain_canonicalDomain(String email) {
        // execution
        String domain = EmailAddressCanonicalizer.domainOf(email);

        // verifications
        assertThat(domain).isEqualTo(DOMAIN);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"no-at-sign", "trailing@", "someone@   "})
    void domainOf_noDomain_throwsIllegalArgument(String email) {
        // execution
        Throwable thrown = catchThrowable(() -> EmailAddressCanonicalizer.domainOf(email));

        // verifications
        assertThat(thrown)
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(NO_DOMAIN);
    }

    @Test
    void canonicalDomain_paddedMixedCase_trimmedAndLowercased() {
        // execution
        String domain = EmailAddressCanonicalizer.canonicalDomain(PADDED_MIXED_CASE_DOMAIN);

        // verifications
        assertThat(domain).isEqualTo(DOMAIN);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "   "})
    void canonicalDomain_blank_null(String domain) {
        // execution
        String canonical = EmailAddressCanonicalizer.canonicalDomain(domain);

        // verifications
        assertThat(canonical).isNull();
    }

    private static Stream<Arguments> canonicalForms() {
        return Stream.of(
                Arguments.of(PADDED_TAGGED_ADDRESS, "someone@example.com"),
                Arguments.of("first.last@example.com", "first.last@example.com"),
                Arguments.of("S.Pam.Mer+promo@Gmail.com", "spammer@gmail.com"),
                Arguments.of("spammer@googlemail.com", "spammer@gmail.com"),
                Arguments.of("+tag@example.com", "+tag@example.com"),
                Arguments.of("...@gmail.com", "...@gmail.com")
        );
    }
}
