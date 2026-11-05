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

    private EmailDomainPolicyProperties properties;
    private EmailDomainPolicy policy;

    @BeforeEach
    void setUp() {
        properties = new EmailDomainPolicyProperties();
        properties.setBlockedDomains(Set.of("Proton.me"));
        properties.setAllowedDomains(Set.of("allowed.example"));
        policy = new EmailDomainPolicy(properties, disposableDomainChecker, List.of(databaseList));
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
}
