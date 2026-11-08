package com.openframe.core.email;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailDomainPolicyTest {

    private static final String BLOCKED_MAILBOX = "spammer@gmail.com";
    private static final String GMAIL_DOMAIN = "gmail.com";
    private static final String ALLOWED_DOMAIN_ADDRESS = "someone@allowed.example";
    private static final String CONFIGURED_BLOCKED_ADDRESS = "someone@proton.me";
    private static final String ROGUE_DOMAIN = "rogue.example";
    private static final String ROGUE_ADDRESS = "someone@rogue.example";
    private static final String FRESH_DOMAIN = "fresh.example";
    private static final String FRESH_ADDRESS = "someone@fresh.example";
    private static final String WORK_DOMAIN = "work.example";
    private static final String WORK_ADDRESS = "someone@work.example";
    private static final String BLOCKED_ADDRESS_MESSAGE = "This email address cannot be used";

    @Mock
    private DisposableDomainChecker disposableDomainChecker;
    @Mock
    private BlockedEmailDomainSource databaseList;
    @Mock
    private BlockedEmailAddressSource addressList;

    private EmailDomainPolicyProperties properties;
    private EmailDomainPolicy policy;

    @BeforeEach
    void setUp() {
        properties = new EmailDomainPolicyProperties();
        properties.setBlockedDomains(Set.of("Proton.me"));
        properties.setAllowedDomains(Set.of("allowed.example"));
        policy = new EmailDomainPolicy(properties, disposableDomainChecker, List.of(databaseList), List.of(addressList));
    }

    @Test
    void isDomainBlocked_configuredListBlocksBeforeAnySource() {
        // execution
        boolean blocked = policy.isDomainBlocked(" PROTON.ME ");
        // verifications
        assertThat(blocked).isTrue();
        verify(databaseList, never()).isBlocked(any());
        verify(disposableDomainChecker, never()).isDisposable(any());
    }

    @Test
    void isDomainBlocked_sourceBlocksWithoutTheExternalCheck() {
        // setup
        when(databaseList.isBlocked("rogue.example")).thenReturn(true);
        // execution
        boolean blocked = policy.isDomainBlocked("Rogue.Example");
        // verifications
        assertThat(blocked).isTrue();
        verify(disposableDomainChecker, never()).isDisposable(any());
    }

    @Test
    void isDomainBlocked_domainUnknownToEveryListFallsThroughToTheExternalCheck() {
        // setup
        when(databaseList.isBlocked("fresh.example")).thenReturn(false);
        when(disposableDomainChecker.isDisposable("fresh.example")).thenReturn(true);
        // execution + verifications
        assertThat(policy.isDomainBlocked("fresh.example")).isTrue();
    }

    @Test
    void isDomainBlocked_allowedCarveOutWinsOverEveryLayer() {
        // setup
        lenient().when(databaseList.isBlocked("allowed.example")).thenReturn(true);
        // execution + verifications
        assertThat(policy.isDomainBlocked("allowed.example")).isFalse();
        verify(disposableDomainChecker, never()).isDisposable(any());
    }

    @Test
    void isDomainListed_asksTheListsOnly() {
        // setup
        when(databaseList.isBlocked("rogue.example")).thenReturn(true);
        when(databaseList.isBlocked("fresh.example")).thenReturn(false);
        // execution + verifications
        assertThat(policy.isDomainListed("proton.me")).isTrue();
        assertThat(policy.isDomainListed("rogue.example")).isTrue();
        assertThat(policy.isDomainListed("fresh.example")).isFalse();
        verify(disposableDomainChecker, never()).isDisposable(any());
    }

    @Test
    void ensureEmailAllowed_namesTheDomainInTheError() {
        // setup
        when(databaseList.isBlocked("rogue.example")).thenReturn(true);
        // execution + verifications
        assertThatThrownBy(() -> policy.ensureEmailAllowed("someone@rogue.example"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("rogue.example");
    }

    @Test
    void isDomainBlocked_disabledPolicyBlocksNothing() {
        // setup
        properties.setEnabled(false);
        // execution + verifications
        assertThat(policy.isDomainBlocked("proton.me")).isFalse();
        verify(databaseList, never()).isBlocked(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"  Spammer+Promo@Gmail.com ", "spammer+1@gmail.com", "s.pammer@googlemail.com"})
    void verdict_anySpellingOfABlockedMailbox_blockedAddress(String email) {
        // setup
        when(addressList.isBlocked(BLOCKED_MAILBOX)).thenReturn(true);

        // execution
        EmailVerdict verdict = policy.verdict(email);

        // verifications
        assertThat(verdict).isEqualTo(EmailVerdict.BLOCKED_ADDRESS);
    }

    @Test
    void verdict_blockedAddress_domainLayersNotAsked() {
        // setup
        when(addressList.isBlocked(BLOCKED_MAILBOX)).thenReturn(true);

        // execution
        policy.verdict(BLOCKED_MAILBOX);

        // verifications
        verify(databaseList, never()).isBlocked(anyString());
        verify(disposableDomainChecker, never()).isDisposable(anyString());
    }

    @Test
    void verdict_blockedAddressOnAnAllowedDomain_blockedAddress() {
        // setup
        when(addressList.isBlocked(ALLOWED_DOMAIN_ADDRESS)).thenReturn(true);

        // execution
        EmailVerdict verdict = policy.verdict(ALLOWED_DOMAIN_ADDRESS);

        // verifications
        assertThat(verdict).isEqualTo(EmailVerdict.BLOCKED_ADDRESS);
    }

    @Test
    void isEmailAllowed_blockedAddressOnAnAllowedDomain_false() {
        // setup
        when(addressList.isBlocked(ALLOWED_DOMAIN_ADDRESS)).thenReturn(true);

        // execution
        boolean allowed = policy.isEmailAllowed(ALLOWED_DOMAIN_ADDRESS);

        // verifications
        assertThat(allowed).isFalse();
    }

    @Test
    void verdict_configuredBlockedDomain_blockedDomain() {
        // execution
        EmailVerdict verdict = policy.verdict(CONFIGURED_BLOCKED_ADDRESS);

        // verifications
        assertThat(verdict).isEqualTo(EmailVerdict.BLOCKED_DOMAIN);
    }

    @Test
    void verdict_domainOnASource_blockedDomain() {
        // setup
        when(databaseList.isBlocked(ROGUE_DOMAIN)).thenReturn(true);

        // execution
        EmailVerdict verdict = policy.verdict(ROGUE_ADDRESS);

        // verifications
        assertThat(verdict).isEqualTo(EmailVerdict.BLOCKED_DOMAIN);
    }

    @Test
    void verdict_disposableDomain_disposable() {
        // setup
        when(databaseList.isBlocked(FRESH_DOMAIN)).thenReturn(false);
        when(disposableDomainChecker.isDisposable(FRESH_DOMAIN)).thenReturn(true);

        // execution
        EmailVerdict verdict = policy.verdict(FRESH_ADDRESS);

        // verifications
        assertThat(verdict).isEqualTo(EmailVerdict.DISPOSABLE);
    }

    @Test
    void verdict_noLayerBlocks_allowed() {
        // setup
        stubWorkAddressAllowedByEveryLayer();

        // execution
        EmailVerdict verdict = policy.verdict(WORK_ADDRESS);

        // verifications
        assertThat(verdict).isEqualTo(EmailVerdict.ALLOWED);
    }

    @Test
    void isEmailAllowed_noLayerBlocks_true() {
        // setup
        stubWorkAddressAllowedByEveryLayer();

        // execution
        boolean allowed = policy.isEmailAllowed(WORK_ADDRESS);

        // verifications
        assertThat(allowed).isTrue();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"not-an-address", "trailing@"})
    void verdict_inputWithoutADomain_allowed(String email) {
        // execution
        EmailVerdict verdict = policy.verdict(email);

        // verifications
        assertThat(verdict).isEqualTo(EmailVerdict.ALLOWED);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"not-an-address", "trailing@"})
    void verdict_inputWithoutADomain_noListAsked(String email) {
        // execution
        policy.verdict(email);

        // verifications
        verify(addressList, never()).isBlocked(anyString());
        verify(databaseList, never()).isBlocked(anyString());
    }

    @Test
    void verdict_disabledPolicy_allowed() {
        // setup
        properties.setEnabled(false);

        // execution
        EmailVerdict verdict = policy.verdict(BLOCKED_MAILBOX);

        // verifications
        assertThat(verdict).isEqualTo(EmailVerdict.ALLOWED);
    }

    @Test
    void verdict_disabledPolicy_addressListNotAsked() {
        // setup
        properties.setEnabled(false);

        // execution
        policy.verdict(BLOCKED_MAILBOX);

        // verifications
        verify(addressList, never()).isBlocked(anyString());
    }

    @Test
    void ensureEmailAllowed_blockedAddress_messageDoesNotNameTheDomain() {
        // setup
        when(addressList.isBlocked(BLOCKED_MAILBOX)).thenReturn(true);

        // execution
        Throwable thrown = catchThrowable(() -> policy.ensureEmailAllowed(BLOCKED_MAILBOX));

        // verifications
        assertThat(thrown)
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(BLOCKED_ADDRESS_MESSAGE)
                .hasMessageNotContaining(GMAIL_DOMAIN);
    }

    private void stubWorkAddressAllowedByEveryLayer() {
        when(addressList.isBlocked(WORK_ADDRESS)).thenReturn(false);
        when(databaseList.isBlocked(WORK_DOMAIN)).thenReturn(false);
        when(disposableDomainChecker.isDisposable(WORK_DOMAIN)).thenReturn(false);
    }
}
