package com.openframe.authz.service.user;

import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.repository.auth.AuthUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import static com.openframe.data.document.user.UserStatus.ACTIVE;
import static com.openframe.data.document.user.UserStatus.DELETED;
import static java.time.LocalDateTime.now;
import static java.util.UUID.randomUUID;

/**
 * Simplified User Service for Authorization Server
 * Only essential operations needed for authentication and user management
 */
@Service
@Transactional
@RequiredArgsConstructor
public class UserService {

    private final AuthUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public Optional<AuthUser> findActiveByEmail(String email) {
        return userRepository.findByEmailAndStatus(email, ACTIVE);
    }

    public Optional<AuthUser> findActiveByEmailAndTenant(String email, String tenantId) {
        return userRepository.findByEmailAndTenantIdAndStatus(email, tenantId, ACTIVE);
    }

    public boolean existsByEmailAndTenant(String email, String tenantId) {
        return userRepository.existsByEmailAndTenantId(email, tenantId);
    }

    /**
     * Register a new user or reactivate an existing DELETED user within the same tenant.
     * Throws conflict if an ACTIVE user already exists in this tenant.
     */
    public AuthUser registerUser(String tenantId, String email, String firstName, String lastName, String password, List<UserRole> roles) {
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        var existing = userRepository.findByEmailAndTenantId(normalized, tenantId);
        return existing
                .map(u -> {
                    if (u.getStatus() == ACTIVE) {
                        throw new IllegalArgumentException("User with this email already exists in this tenant");
                    }
                    return reactivateUser(u, firstName, lastName, password, roles);
                })
                .orElseGet(() -> createUser(tenantId, email, firstName, lastName, password, roles));
    }

    public void deactivateUser(AuthUser user) {
        user.setStatus(DELETED);
        userRepository.save(user);
    }

    public AuthUser reactivateUser(AuthUser user,
                                   String firstName,
                                   String lastName,
                                   String rawPassword,
                                   List<UserRole> roles) {
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setRoles(roles);
        user.setStatus(ACTIVE);
        user.setUpdatedAt(now());
        return userRepository.save(user);
    }

    private AuthUser createUser(String tenantId,
                                String email,
                                String firstName,
                                String lastName,
                                String rawPassword,
                                List<UserRole> roles) {
        AuthUser user = AuthUser.builder()
                .id(randomUUID().toString())
                .tenantId(tenantId)
                .email(email)
                .firstName(firstName)
                .lastName(lastName)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .status(ACTIVE)
                .emailVerified(false)
                .createdAt(now())
                .roles(roles)
                .loginProvider("LOCAL")
                .build();
        return userRepository.save(user);
    }

    public void updatePassword(String userId, String rawPassword) {
        userRepository.findById(userId).ifPresentOrElse(user -> {
            user.setPasswordHash(passwordEncoder.encode(rawPassword));
            userRepository.save(user);
        }, () -> {
            throw new IllegalArgumentException("User not found: " + userId);
        });
    }

    /**
     * Register or reactivate a user via SSO provider.
     * Sets emailVerified=true and loginProvider to the given provider.
     */
    public AuthUser registerOrReactivateFromSso(String tenantId,
                                                String email,
                                                String firstName,
                                                String lastName,
                                                List<UserRole> roles,
                                                String providerRegistrationId) {
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        var existing = userRepository.findByEmailAndTenantId(normalized, tenantId);
        return existing
                .map(u -> {
                    if (u.getStatus() == ACTIVE) {
                        u.setEmailVerified(true);
                        u.setLoginProvider(providerRegistrationId);
                        u.setUpdatedAt(now());
                        return userRepository.save(u);
                    }
                    return reactivateUserFromSso(u, firstName, lastName, roles, providerRegistrationId);
                })
                .orElseGet(() -> createUserFromSso(tenantId, email, firstName, lastName, roles, providerRegistrationId));
    }

    private AuthUser reactivateUserFromSso(AuthUser user,
                                           String firstName,
                                           String lastName,
                                           List<UserRole> roles,
                                           String providerRegistrationId) {
        String randomPassword = randomUUID().toString();
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setPasswordHash(passwordEncoder.encode(randomPassword));
        user.setRoles(roles);
        user.setStatus(ACTIVE);
        user.setEmailVerified(true);
        user.setLoginProvider(providerRegistrationId);
        user.setUpdatedAt(now());
        return userRepository.save(user);
    }

    private AuthUser createUserFromSso(String tenantId,
                                       String email,
                                       String firstName,
                                       String lastName,
                                       List<UserRole> roles,
                                       String providerRegistrationId) {
        String randomPassword = randomUUID().toString();
        AuthUser user = AuthUser.builder()
                .id(randomUUID().toString())
                .tenantId(tenantId)
                .email(email)
                .firstName(firstName)
                .lastName(lastName)
                .passwordHash(passwordEncoder.encode(randomPassword))
                .status(ACTIVE)
                .emailVerified(true)
                .createdAt(now())
                .roles(roles)
                .loginProvider(providerRegistrationId)
                .build();
        return userRepository.save(user);
    }

    /**
     * Update lastLogin timestamp for a user identified by email within the given tenant.
     * No-op if user is not found.
     */
    public void touchLastLogin(String email, String tenantId) {
        if (email == null || tenantId == null) {
            return;
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        userRepository.findByEmailAndTenantId(normalized, tenantId).ifPresent(user -> {
            user.setLastLogin(Instant.now());
            user.setUpdatedAt(now());
            userRepository.save(user);
        });
    }
}