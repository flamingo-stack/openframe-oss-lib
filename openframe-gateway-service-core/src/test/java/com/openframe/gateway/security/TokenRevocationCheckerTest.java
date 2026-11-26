package com.openframe.gateway.security;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.tenant.TenantStatus;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.reactive.repository.device.ReactiveMachineRepository;
import com.openframe.data.reactive.repository.tenant.ReactiveTenantRepository;
import com.openframe.data.reactive.repository.user.ReactiveUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TokenRevocationCheckerTest {

    private static final String USER_ID = "user-1";
    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final Instant REVOKED_AT = Instant.parse("2026-11-23T01:39:56Z");
    private static final String REVOKED_MESSAGE = "Token has been revoked";

    @Mock private ReactiveUserRepository userRepository;
    @Mock private ReactiveMachineRepository machineRepository;
    @Mock private ReactiveTenantRepository tenantRepository;

    private TokenRevocationChecker checker;
    private User user;
    private Machine machine;
    private Tenant tenant;

    @BeforeEach
    void setUp() {
        checker = new TokenRevocationChecker(userRepository, machineRepository, tenantRepository, true, Duration.ofSeconds(10), 100L);
        user = new User();
        user.setId(USER_ID);
        user.setTenantId(TENANT_ID);
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        tenant = new Tenant();
        tenant.setId(TENANT_ID);
    }

    @Test
    void verify_flagOff_completesWithoutLookup() {
        // setup
        TokenRevocationChecker disabled =
                new TokenRevocationChecker(userRepository, machineRepository, tenantRepository, false, Duration.ofSeconds(10), 100L);
        Jwt jwt = userJwt(REVOKED_AT.minusSeconds(60));

        // execution
        Mono<Void> result = disabled.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
        verifyNoInteractions(userRepository, machineRepository, tenantRepository);
    }

    @Test
    void verify_noUserOrMachineClaim_completesWithoutLookup() {
        // setup
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "RS256").subject("someone").build();

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
        verifyNoInteractions(userRepository, machineRepository, tenantRepository);
    }

    @Test
    void verify_activeUserWithoutRevocation_completes() {
        // setup
        stubActiveTenant();
        when(userRepository.findByTenantIdAndId(TENANT_ID, USER_ID)).thenReturn(Mono.just(user));
        Jwt jwt = userJwt(REVOKED_AT);

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
    }

    @ParameterizedTest
    @EnumSource(value = UserStatus.class, names = {"DELETED", "SELF_DELETED"})
    void verify_userNotActive_rejected(UserStatus status) {
        // setup
        user.setStatus(status);
        when(userRepository.findByTenantIdAndId(TENANT_ID, USER_ID)).thenReturn(Mono.just(user));
        Jwt jwt = userJwt(REVOKED_AT);

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result)
                .expectErrorSatisfies(error -> assertThat(error)
                        .isInstanceOf(InvalidBearerTokenException.class)
                        .hasMessage(REVOKED_MESSAGE))
                .verify();
    }

    @Test
    void verify_tokenIssuedBeforeRevocation_rejected() {
        // setup
        user.setTokensRevokedAt(REVOKED_AT);
        when(userRepository.findByTenantIdAndId(TENANT_ID, USER_ID)).thenReturn(Mono.just(user));
        Jwt jwt = userJwt(REVOKED_AT.minusSeconds(1));

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).expectErrorMessage(REVOKED_MESSAGE).verify();
    }

    @Test
    void verify_tokenIssuedInRevocationSecond_completes() {
        // setup
        stubActiveTenant();
        user.setTokensRevokedAt(REVOKED_AT);
        when(userRepository.findByTenantIdAndId(TENANT_ID, USER_ID)).thenReturn(Mono.just(user));
        Jwt jwt = userJwt(REVOKED_AT);

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
    }

    @Test
    void verify_tokenWithoutIssuedAt_revokedActiveUser_completes() {
        // setup
        stubActiveTenant();
        user.setTokensRevokedAt(REVOKED_AT);
        when(userRepository.findByTenantIdAndId(TENANT_ID, USER_ID)).thenReturn(Mono.just(user));
        Jwt jwt = userJwtWithoutIssuedAt();

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
    }

    @Test
    void verify_userNotFound_completes() {
        // setup
        stubActiveTenant();
        when(userRepository.findByTenantIdAndId(TENANT_ID, USER_ID)).thenReturn(Mono.empty());
        Jwt jwt = userJwt(REVOKED_AT);

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
    }

    @Test
    void verify_userLookupFails_completes() {
        // setup
        stubActiveTenant();
        when(userRepository.findByTenantIdAndId(TENANT_ID, USER_ID))
                .thenReturn(Mono.error(new IllegalStateException("mongo down")));
        Jwt jwt = userJwt(REVOKED_AT);

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
    }

    @Test
    void verify_userLookupFailed_retriedOnNextRequest() {
        // setup
        stubActiveTenant();
        when(userRepository.findByTenantIdAndId(TENANT_ID, USER_ID))
                .thenReturn(Mono.error(new IllegalStateException("mongo down")))
                .thenReturn(Mono.just(user));
        Jwt jwt = userJwt(REVOKED_AT);

        // execution
        checker.verify(jwt).block();
        checker.verify(jwt).block();

        // verifications
        verify(userRepository, times(2)).findByTenantIdAndId(TENANT_ID, USER_ID);
    }

    @Test
    void verify_sameUserTwice_lookedUpOnce() {
        // setup
        stubActiveTenant();
        when(userRepository.findByTenantIdAndId(TENANT_ID, USER_ID)).thenReturn(Mono.just(user));
        Jwt jwt = userJwt(REVOKED_AT);

        // execution
        checker.verify(jwt).block();
        checker.verify(jwt).block();

        // verifications
        verify(userRepository).findByTenantIdAndId(TENANT_ID, USER_ID);
    }

    @Test
    void verify_userTokenWithoutTenant_lookedUpById() {
        // setup
        when(userRepository.findById(USER_ID)).thenReturn(Mono.just(user));
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "RS256")
                .claim(TokenRevocationChecker.USER_ID_CLAIM, USER_ID)
                .issuedAt(REVOKED_AT)
                .build();

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
        verify(userRepository, never()).findByTenantIdAndId(TENANT_ID, USER_ID);
    }

    @Test
    void verify_deletedMachine_rejected() {
        // setup
        machine.setStatus(DeviceStatus.DELETED);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Mono.just(machine));
        Jwt jwt = machineJwt();

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).expectErrorMessage(REVOKED_MESSAGE).verify();
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = "DELETED", mode = EnumSource.Mode.EXCLUDE)
    void verify_machineNotDeleted_completes(DeviceStatus status) {
        // setup
        machine.setStatus(status);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Mono.just(machine));
        Jwt jwt = machineJwt();

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
    }

    @Test
    void verify_machineNotFound_completes() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Mono.empty());
        Jwt jwt = machineJwt();

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
    }

    @ParameterizedTest
    @EnumSource(value = TenantStatus.class, names = {"BLOCKED", "DELETED"})
    void verify_userOfRemovedTenant_rejected(TenantStatus status) {
        // setup
        tenant.setStatus(status);
        when(userRepository.findByTenantIdAndId(TENANT_ID, USER_ID)).thenReturn(Mono.just(user));
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Mono.just(tenant));
        Jwt jwt = userJwt(REVOKED_AT);

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).expectErrorMessage(REVOKED_MESSAGE).verify();
    }

    @Test
    void verify_revokedUser_tenantNotLookedUp() {
        // setup
        user.setStatus(UserStatus.DELETED);
        when(userRepository.findByTenantIdAndId(TENANT_ID, USER_ID)).thenReturn(Mono.just(user));
        Jwt jwt = userJwt(REVOKED_AT);

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).expectErrorMessage(REVOKED_MESSAGE).verify();
        verifyNoInteractions(tenantRepository);
    }

    @Test
    void verify_tenantNotFound_completes() {
        // setup
        when(userRepository.findByTenantIdAndId(TENANT_ID, USER_ID)).thenReturn(Mono.just(user));
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Mono.empty());
        Jwt jwt = userJwt(REVOKED_AT);

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
    }

    @Test
    void verify_tenantLookupFails_completes() {
        // setup
        when(userRepository.findByTenantIdAndId(TENANT_ID, USER_ID)).thenReturn(Mono.just(user));
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Mono.error(new IllegalStateException("mongo down")));
        Jwt jwt = userJwt(REVOKED_AT);

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
    }

    @Test
    void verify_userTokenWithoutTenant_tenantNotLookedUp() {
        // setup
        when(userRepository.findById(USER_ID)).thenReturn(Mono.just(user));
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "RS256")
                .claim(TokenRevocationChecker.USER_ID_CLAIM, USER_ID)
                .issuedAt(REVOKED_AT)
                .build();

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
        verifyNoInteractions(tenantRepository);
    }

    @ParameterizedTest
    @EnumSource(value = TenantStatus.class, names = {"BLOCKED", "DELETED"})
    void verify_machineOfRemovedTenant_rejected(TenantStatus status) {
        // setup
        machine.setTenantId(TENANT_ID);
        tenant.setStatus(status);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Mono.just(machine));
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Mono.just(tenant));
        Jwt jwt = machineJwt();

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).expectErrorMessage(REVOKED_MESSAGE).verify();
    }

    @Test
    void verify_machineOfActiveTenant_completes() {
        // setup
        machine.setTenantId(TENANT_ID);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Mono.just(machine));
        stubActiveTenant();
        Jwt jwt = machineJwt();

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
    }

    @Test
    void verify_machineTokenIssuedBeforeRevocation_rejected() {
        // setup
        machine.setTokensRevokedAt(REVOKED_AT.plusSeconds(1));
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Mono.just(machine));
        Jwt jwt = machineJwt();

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).expectErrorMessage(REVOKED_MESSAGE).verify();
    }

    @Test
    void verify_machineTokenIssuedInRevocationSecond_completes() {
        // setup
        machine.setTokensRevokedAt(REVOKED_AT);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Mono.just(machine));
        Jwt jwt = machineJwt();

        // execution
        Mono<Void> result = checker.verify(jwt);

        // verifications
        StepVerifier.create(result).verifyComplete();
    }

    @Test
    void verify_sameTenantForTwoTokens_lookedUpOnce() {
        // setup
        machine.setTenantId(TENANT_ID);
        when(userRepository.findByTenantIdAndId(TENANT_ID, USER_ID)).thenReturn(Mono.just(user));
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Mono.just(machine));
        stubActiveTenant();
        Jwt userToken = userJwt(REVOKED_AT);
        Jwt machineToken = machineJwt();

        // execution
        checker.verify(userToken).block();
        checker.verify(machineToken).block();

        // verifications
        verify(tenantRepository).findById(TENANT_ID);
    }

    private void stubActiveTenant() {
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Mono.just(tenant));
    }

    private static Jwt userJwt(Instant issuedAt) {
        return Jwt.withTokenValue("token").header("alg", "RS256")
                .claim(TokenRevocationChecker.USER_ID_CLAIM, USER_ID)
                .claim(TokenRevocationChecker.TENANT_ID_CLAIM, TENANT_ID)
                .issuedAt(issuedAt)
                .build();
    }

    private static Jwt userJwtWithoutIssuedAt() {
        return Jwt.withTokenValue("token").header("alg", "RS256")
                .claim(TokenRevocationChecker.USER_ID_CLAIM, USER_ID)
                .claim(TokenRevocationChecker.TENANT_ID_CLAIM, TENANT_ID)
                .build();
    }

    private static Jwt machineJwt() {
        return Jwt.withTokenValue("token").header("alg", "RS256")
                .subject("agent_" + MACHINE_ID)
                .claim(TokenRevocationChecker.MACHINE_ID_CLAIM, MACHINE_ID)
                .issuedAt(REVOKED_AT)
                .build();
    }
}
