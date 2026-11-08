package com.openframe.core.email;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailDomainPolicyTest {

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

    @Test
    void normalizeDomain_trimsAndLowercases() {
        assertThat(EmailDomainPolicy.normalizeDomain("  Example.COM ")).isEqualTo("example.com");
        assertThat(EmailDomainPolicy.normalizeDomain("   ")).isNull();
        assertThat(EmailDomainPolicy.normalizeDomain(null)).isNull();
    }

    @Test
    void verdict_addressBlockIsCheckedFirstAndNamesTheAddress() {
        // setup
        when(addressList.isBlocked("spammer+promo@gmail.com")).thenReturn(true);
        // execution
        EmailVerdict verdict = policy.verdict("  Spammer+Promo@Gmail.com ");
        // verifications
        assertThat(verdict).isEqualTo(EmailVerdict.BLOCKED_ADDRESS);
        verify(databaseList, never()).isBlocked(any());
        verify(disposableDomainChecker, never()).isDisposable(any());
    }

    @Test
    void verdict_addressBlockIsNotLiftedByTheAllowedCarveOut() {
        // setup
        when(addressList.isBlocked("someone@allowed.example")).thenReturn(true);
        // execution + verifications
        assertThat(policy.verdict("someone@allowed.example")).isEqualTo(EmailVerdict.BLOCKED_ADDRESS);
        assertThat(policy.isEmailAllowed("someone@allowed.example")).isFalse();
    }

    @Test
    void verdict_namesTheDomainLayerThatDecided() {
        // setup
        when(databaseList.isBlocked("rogue.example")).thenReturn(true);
        when(databaseList.isBlocked("fresh.example")).thenReturn(false);
        when(databaseList.isBlocked("work.example")).thenReturn(false);
        when(disposableDomainChecker.isDisposable("fresh.example")).thenReturn(true);
        when(disposableDomainChecker.isDisposable("work.example")).thenReturn(false);
        // execution + verifications
        assertThat(policy.verdict("a@proton.me")).isEqualTo(EmailVerdict.BLOCKED_DOMAIN);
        assertThat(policy.verdict("a@rogue.example")).isEqualTo(EmailVerdict.BLOCKED_DOMAIN);
        assertThat(policy.verdict("a@fresh.example")).isEqualTo(EmailVerdict.DISPOSABLE);
        assertThat(policy.verdict("a@work.example")).isEqualTo(EmailVerdict.ALLOWED);
    }

    @Test
    void verdict_inputWithoutAnAddressIsAllowedWithoutAskingAnySource() {
        // execution + verifications
        assertThat(policy.verdict("not-an-address")).isEqualTo(EmailVerdict.ALLOWED);
        assertThat(policy.verdict(null)).isEqualTo(EmailVerdict.ALLOWED);
        verify(addressList, never()).isBlocked(any());
        verify(databaseList, never()).isBlocked(any());
    }

    @Test
    void verdict_disabledPolicyIgnoresTheAddressList() {
        // setup
        properties.setEnabled(false);
        // execution + verifications
        assertThat(policy.verdict("spammer@gmail.com")).isEqualTo(EmailVerdict.ALLOWED);
        verify(addressList, never()).isBlocked(any());
    }

    @Test
    void ensureEmailAllowed_blockedAddressDoesNotBlameTheDomain() {
        // setup
        when(addressList.isBlocked("spammer@gmail.com")).thenReturn(true);
        // execution + verifications
        assertThatThrownBy(() -> policy.ensureEmailAllowed("spammer@gmail.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("This email address cannot be used")
                .hasMessageNotContaining("gmail.com");
    }

    @Test
    void isEmailAllowed_addressNoLayerBlocksIsAllowed() {
        // setup
        when(addressList.isBlocked("someone@work.example")).thenReturn(false);
        when(databaseList.isBlocked("work.example")).thenReturn(false);
        when(disposableDomainChecker.isDisposable("work.example")).thenReturn(false);
        // execution + verifications: SSO auto-provisioning reads this method, so an allowed address must stay allowed
        assertThat(policy.isEmailAllowed("someone@work.example")).isTrue();
    }

    @Test
    void domainOf_namesTheDomainOnly() {
        assertThat(EmailDomainPolicy.domainOf(" Someone+Tag@Example.COM ")).isEqualTo("example.com");
        assertThat(EmailDomainPolicy.domainOf("no-at-sign")).isNull();
        assertThat(EmailDomainPolicy.domainOf("trailing@")).isNull();
        assertThat(EmailDomainPolicy.domainOf(null)).isNull();
    }

    @Test
    void normalizeEmail_trimsAndLowercasesAndKeepsThePlusTag() {
        assertThat(EmailDomainPolicy.normalizeEmail("  Someone+Tag@Example.COM ")).isEqualTo("someone+tag@example.com");
        assertThat(EmailDomainPolicy.normalizeEmail("   ")).isNull();
        assertThat(EmailDomainPolicy.normalizeEmail(null)).isNull();
    }
}
