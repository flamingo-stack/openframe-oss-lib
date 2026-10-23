package com.openframe.authz.service.user;

import com.openframe.authz.service.processor.UserEmailVerifiedProcessor;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.auth.AuthUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private AuthUserRepository repository;
    @Mock
    private UserEmailVerifiedProcessor verifiedProcessor;

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private UserService service;

    @BeforeEach
    void setUp() {
        service = new UserService(repository, encoder, verifiedProcessor);
        lenient().when(repository.save(any(AuthUser.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static AuthUser deleted(String email) {
        AuthUser user = activeUser("old", "t", email);
        user.setStatus(UserStatus.DELETED);
        return user;
    }

    @Test
    void shouldCreateUserWithEncodedPasswordAndLocalProvider() {
        when(repository.findByEmailAndTenantId("ada@acme.com", "t")).thenReturn(Optional.empty());

        AuthUser user = service.registerUser("t", "ada@acme.com", "Ada", "L", "Str0ng-password!", List.of(UserRole.ADMIN));

        assertThat(user.getPasswordHash()).isNotEqualTo("Str0ng-password!");
        assertThat(encoder.matches("Str0ng-password!", user.getPasswordHash())).isTrue();
        assertThat(user.getLoginProvider()).isEqualTo("LOCAL");
        assertThat(user.isEmailVerified()).isFalse();
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(user.getCreatedAt()).isNotNull();
    }

    @Test
    void shouldRejectRegistrationOfActiveEmailInSameTenant() {
        when(repository.findByEmailAndTenantId("ada@acme.com", "t")).thenReturn(Optional.of(activeUser("u", "t", "ada@acme.com")));

        assertThatThrownBy(() -> service.registerUser("t", " Ada@Acme.com ", "A", "L", "p", List.of()))
                .hasMessageContaining("already exists in this tenant");
    }

    @Test
    void shouldReactivateDeletedUserWithNewPasswordAndRoles() {
        AuthUser old = deleted("ada@acme.com");
        when(repository.findByEmailAndTenantId("ada@acme.com", "t")).thenReturn(Optional.of(old));

        AuthUser user = service.registerUser("t", "ada@acme.com", "New", "Name", "N3w-password!", List.of(UserRole.OWNER));

        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(user.getRoles()).containsExactly(UserRole.OWNER);
        assertThat(encoder.matches("N3w-password!", user.getPasswordHash())).isTrue();
    }

    @Test
    void shouldCreateSsoUserVerifiedWithUnguessablePassword() {
        when(repository.findByEmailAndTenantId("ada@acme.com", "t")).thenReturn(Optional.empty());

        AuthUser user = service.registerOrReactivateFromSso("t", "ada@acme.com", "Ada", "L", List.of(UserRole.ADMIN), "google");

        assertThat(user.isEmailVerified()).isTrue();
        assertThat(user.getLoginProvider()).isEqualTo("google");
        assertThat(user.getPasswordHash()).isNotBlank();
        assertThat(encoder.matches("", user.getPasswordHash())).isFalse();
    }

    @Test
    void shouldRefreshActiveUserOnSsoWithoutOverwritingNames() {
        AuthUser existing = activeUser("u", "t", "ada@acme.com");
        existing.setFirstName("Kept");
        existing.setLastName("");
        existing.setPasswordHash("hash");
        when(repository.findByEmailAndTenantId("ada@acme.com", "t")).thenReturn(Optional.of(existing));

        AuthUser user = service.registerOrReactivateFromSso("t", "ada@acme.com", "Other", "Filled", List.of(UserRole.ADMIN), "microsoft");

        assertThat(user.getFirstName()).isEqualTo("Kept");
        assertThat(user.getLastName()).isEqualTo("Filled");
        assertThat(user.getPasswordHash()).isEqualTo("hash");
        assertThat(user.isEmailVerified()).isTrue();
        assertThat(user.getLoginProvider()).isEqualTo("microsoft");
    }

    @Test
    void shouldDetectActiveAccountOnlyInOtherTenants() {
        when(repository.findAllByEmailAndStatus("ada@acme.com", UserStatus.ACTIVE))
                .thenReturn(List.of(activeUser("u", "t", "ada@acme.com")));

        assertThat(service.hasActiveAccountInAnotherTenant(" ADA@acme.com", "t")).isFalse();
        assertThat(service.hasActiveAccountInAnotherTenant("ada@acme.com", "other")).isTrue();
    }

    @Test
    void shouldFireVerifiedProcessorOnlyOnFirstVerification() {
        AuthUser unverified = activeUser("u", "t", "a@acme.com");
        AuthUser verified = activeUser("v", "t", "b@acme.com");
        verified.setEmailVerified(true);
        when(repository.findById("u")).thenReturn(Optional.of(unverified));
        when(repository.findById("v")).thenReturn(Optional.of(verified));

        service.markEmailVerified("u");
        service.markEmailVerified("v");
        service.markEmailVerified(" ");

        verify(verifiedProcessor).postProcessEmailVerified(unverified);
        verify(verifiedProcessor, never()).postProcessEmailVerified(verified);
    }

    @Test
    void shouldExcludeInactiveUsersFromActiveLookupById() {
        when(repository.findById("old")).thenReturn(Optional.of(deleted("a@acme.com")));

        assertThat(service.findActiveById("old")).isEmpty();
    }

    @Test
    void shouldFailPasswordUpdateForUnknownUser() {
        when(repository.findById("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updatePassword("ghost", "p")).hasMessageContaining("User not found");
    }
}
