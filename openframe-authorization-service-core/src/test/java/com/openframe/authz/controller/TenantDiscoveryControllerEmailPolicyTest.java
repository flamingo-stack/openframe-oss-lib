package com.openframe.authz.controller;

import com.openframe.authz.dto.EmailAvailabilityResponse;
import com.openframe.authz.dto.EmailDomainAllowedResponse;
import com.openframe.authz.service.tenant.TenantDiscoveryService;
import com.openframe.authz.service.user.UserService;
import com.openframe.core.email.EmailDomainPolicy;
import com.openframe.core.email.EmailVerdict;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantDiscoveryControllerEmailPolicyTest {

    @Mock
    private TenantDiscoveryService tenantDiscoveryService;
    @Mock
    private UserService userService;
    @Mock
    private EmailDomainPolicy emailDomainPolicy;
    @InjectMocks
    private TenantDiscoveryController controller;

    @ParameterizedTest
    @CsvSource({
            "BLOCKED_ADDRESS, BLOCKED_ADDRESS",
            "BLOCKED_DOMAIN, BLOCKED_DOMAIN",
            "DISPOSABLE, DISPOSABLE"
    })
    void emailDomainAllowed_namesTheLayerThatBlocked(EmailVerdict verdict, EmailDomainAllowedResponse.Reason reason) {
        // setup
        when(emailDomainPolicy.verdict("spammer@example.com")).thenReturn(verdict);
        // execution
        EmailDomainAllowedResponse response = controller.emailDomainAllowed("Spammer@Example.com");
        // verifications
        assertThat(response.isAllowed()).isFalse();
        assertThat(response.getReason()).isEqualTo(reason);
    }

    @Test
    void emailDomainAllowed_allowedAddressHasNoReason() {
        // setup
        when(emailDomainPolicy.verdict("someone@work.example")).thenReturn(EmailVerdict.ALLOWED);
        // execution
        EmailDomainAllowedResponse response = controller.emailDomainAllowed("someone@work.example");
        // verifications
        assertThat(response.isAllowed()).isTrue();
        assertThat(response.getReason()).isNull();
    }

    @ParameterizedTest
    @CsvSource({
            "BLOCKED_ADDRESS, BLOCKED_ADDRESS",
            "BLOCKED_DOMAIN, BLOCKED_DOMAIN",
            "DISPOSABLE, BLOCKED_DOMAIN"
    })
    void emailAvailable_blockedAddressIsToldApartFromABlockedDomain(EmailVerdict verdict,
                                                                    EmailAvailabilityResponse.Reason reason) {
        // setup
        when(userService.existsActiveByEmail("spammer@example.com")).thenReturn(false);
        when(emailDomainPolicy.verdict("spammer@example.com")).thenReturn(verdict);
        // execution
        EmailAvailabilityResponse response = controller.emailAvailable("spammer@example.com");
        // verifications
        assertThat(response.isAvailable()).isFalse();
        assertThat(response.getReason()).isEqualTo(reason);
    }

    @Test
    void emailAvailable_takenAddressNeverAsksThePolicy() {
        // setup
        when(userService.existsActiveByEmail("taken@example.com")).thenReturn(true);
        // execution
        EmailAvailabilityResponse response = controller.emailAvailable("taken@example.com");
        // verifications
        assertThat(response.getReason()).isEqualTo(EmailAvailabilityResponse.Reason.TAKEN);
        verify(emailDomainPolicy, never()).verdict(any());
    }
}
