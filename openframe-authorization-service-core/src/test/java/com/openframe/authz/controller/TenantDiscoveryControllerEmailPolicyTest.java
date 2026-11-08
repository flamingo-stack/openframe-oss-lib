package com.openframe.authz.controller;

import com.openframe.authz.dto.EmailAvailabilityResponse;
import com.openframe.authz.dto.EmailDomainAllowedResponse;
import com.openframe.authz.dto.EmailRefusalReason;
import com.openframe.authz.service.tenant.TenantDiscoveryService;
import com.openframe.authz.service.user.UserService;
import com.openframe.core.email.EmailDomainPolicy;
import com.openframe.core.email.EmailVerdict;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantDiscoveryControllerEmailPolicyTest {

    private static final String EMAIL = "someone@example.com";
    private static final String MIXED_CASE_EMAIL = "Someone@Example.com";

    @Mock
    private TenantDiscoveryService tenantDiscoveryService;
    @Mock
    private UserService userService;
    @Mock
    private EmailDomainPolicy emailDomainPolicy;
    @InjectMocks
    private TenantDiscoveryController controller;

    @ParameterizedTest
    @MethodSource("domainAllowedRefusals")
    void emailDomainAllowed_blockedVerdict_refusedWithTheLayerThatBlocked(EmailVerdict verdict,
                                                                          EmailRefusalReason reason) {
        // setup
        when(emailDomainPolicy.verdict(MIXED_CASE_EMAIL)).thenReturn(verdict);

        // execution
        EmailDomainAllowedResponse response = controller.emailDomainAllowed(MIXED_CASE_EMAIL);

        // verifications
        assertThat(response)
                .extracting(EmailDomainAllowedResponse::isAllowed, EmailDomainAllowedResponse::getReason)
                .containsExactly(false, reason);
    }

    @Test
    void emailDomainAllowed_allowedVerdict_allowedWithoutReason() {
        // setup
        when(emailDomainPolicy.verdict(EMAIL)).thenReturn(EmailVerdict.ALLOWED);

        // execution
        EmailDomainAllowedResponse response = controller.emailDomainAllowed(EMAIL);

        // verifications
        assertThat(response)
                .extracting(EmailDomainAllowedResponse::isAllowed, EmailDomainAllowedResponse::getReason)
                .containsExactly(true, null);
    }

    @ParameterizedTest
    @MethodSource("availabilityRefusals")
    void emailAvailable_blockedVerdict_unavailableWithItsReason(EmailVerdict verdict, EmailRefusalReason reason) {
        // setup
        when(userService.existsActiveByEmail(EMAIL)).thenReturn(false);
        when(emailDomainPolicy.verdict(EMAIL)).thenReturn(verdict);

        // execution
        EmailAvailabilityResponse response = controller.emailAvailable(EMAIL);

        // verifications
        assertThat(response)
                .extracting(EmailAvailabilityResponse::isAvailable, EmailAvailabilityResponse::getReason)
                .containsExactly(false, reason);
    }

    @Test
    void emailAvailable_allowedVerdict_availableWithoutReason() {
        // setup
        when(userService.existsActiveByEmail(EMAIL)).thenReturn(false);
        when(emailDomainPolicy.verdict(EMAIL)).thenReturn(EmailVerdict.ALLOWED);

        // execution
        EmailAvailabilityResponse response = controller.emailAvailable(EMAIL);

        // verifications
        assertThat(response)
                .extracting(EmailAvailabilityResponse::isAvailable, EmailAvailabilityResponse::getReason)
                .containsExactly(true, null);
    }

    @Test
    void emailAvailable_takenAddress_unavailableAsTaken() {
        // setup
        when(userService.existsActiveByEmail(EMAIL)).thenReturn(true);

        // execution
        EmailAvailabilityResponse response = controller.emailAvailable(EMAIL);

        // verifications
        assertThat(response)
                .extracting(EmailAvailabilityResponse::isAvailable, EmailAvailabilityResponse::getReason)
                .containsExactly(false, EmailRefusalReason.TAKEN);
    }

    @Test
    void emailAvailable_takenAddress_policyNotAsked() {
        // setup
        when(userService.existsActiveByEmail(EMAIL)).thenReturn(true);

        // execution
        controller.emailAvailable(EMAIL);

        // verifications
        verify(emailDomainPolicy, never()).verdict(anyString());
    }

    private static Stream<Arguments> domainAllowedRefusals() {
        return Stream.of(
                Arguments.of(EmailVerdict.BLOCKED_ADDRESS, EmailRefusalReason.BLOCKED_ADDRESS),
                Arguments.of(EmailVerdict.BLOCKED_DOMAIN, EmailRefusalReason.BLOCKED_DOMAIN),
                Arguments.of(EmailVerdict.DISPOSABLE, EmailRefusalReason.DISPOSABLE)
        );
    }

    private static Stream<Arguments> availabilityRefusals() {
        return Stream.of(
                Arguments.of(EmailVerdict.BLOCKED_ADDRESS, EmailRefusalReason.BLOCKED_ADDRESS),
                Arguments.of(EmailVerdict.BLOCKED_DOMAIN, EmailRefusalReason.BLOCKED_DOMAIN),
                Arguments.of(EmailVerdict.DISPOSABLE, EmailRefusalReason.BLOCKED_DOMAIN)
        );
    }
}
