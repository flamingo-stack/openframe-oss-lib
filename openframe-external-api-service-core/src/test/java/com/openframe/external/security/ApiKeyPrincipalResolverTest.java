package com.openframe.external.security;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.core.exception.UnauthorizedException;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApiKeyPrincipalResolverTest {

    private static final String USER_ID = "user-1";
    private static final String POD_TENANT = "tenant-pod";

    @Mock
    private UserRepository userRepository;

    @Mock
    private TenantIdProvider tenantIdProvider;

    @InjectMocks
    private ApiKeyPrincipalResolver resolver;

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t\n"})
    void missingUserIdIsUnauthorizedWithoutAnyLookup(String userId) {
        UnauthorizedException ex = assertThrows(UnauthorizedException.class, () -> resolver.resolve(userId));

        assertEquals("API key is not bound to a user", ex.getMessage());
        assertEquals(ErrorCode.UNAUTHORIZED, ex.getErrorCode());
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getHttpStatus());
        verifyNoInteractions(userRepository, tenantIdProvider);
    }

    @Test
    void unknownUserIsUnauthorized() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());

        UnauthorizedException ex = assertThrows(UnauthorizedException.class, () -> resolver.resolve(USER_ID));

        assertEquals("API key owner not found", ex.getMessage());
        assertEquals(ErrorCode.UNAUTHORIZED, ex.getErrorCode());
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getHttpStatus());
        verifyNoInteractions(tenantIdProvider);
    }

    @ParameterizedTest
    @EnumSource(value = UserStatus.class, mode = EnumSource.Mode.EXCLUDE, names = "ACTIVE")
    void nonActiveOwnerIsForbidden(UserStatus status) {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(status, List.of(UserRole.ADMIN))));

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> resolver.resolve(USER_ID));

        assertEquals("API key owner is not active", ex.getMessage());
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
        verifyNoInteractions(tenantIdProvider);
    }

    @Test
    void ownerWithoutStatusIsForbidden() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(null, List.of(UserRole.ADMIN))));

        assertThrows(ForbiddenException.class, () -> resolver.resolve(USER_ID));

        verifyNoInteractions(tenantIdProvider);
    }

    @Test
    void activeOwnerBecomesAdminActorWithItsIdentity() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(UserStatus.ACTIVE, List.of(UserRole.ADMIN))));
        when(tenantIdProvider.getTenantId()).thenReturn(POD_TENANT);

        AuthPrincipal principal = resolver.resolve(USER_ID);

        assertEquals(USER_ID, principal.getId());
        assertEquals("jane@example.com", principal.getEmail());
        assertEquals("Jane", principal.getFirstName());
        assertEquals("Doe", principal.getLastName());
        assertEquals("Jane Doe", principal.getDisplayName());
        assertEquals(List.of("ADMIN"), principal.getRoles());
        assertEquals(ActorType.ADMIN, principal.getActorType());
        assertTrue(principal.getScopes().isEmpty());
        assertNull(principal.getTenantDomain());
        assertNull(principal.getMachineId());
    }

    @Test
    void tenantIdComesFromTheProviderNotFromTheUserDocument() {
        User user = user(UserStatus.ACTIVE, List.of(UserRole.ADMIN));
        user.setTenantId("tenant-on-user-document");
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(tenantIdProvider.getTenantId()).thenReturn(POD_TENANT);

        assertEquals(POD_TENANT, resolver.resolve(USER_ID).getTenantId());
    }

    @Test
    void unresolvedTenantIsPassedThroughAsNull() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(UserStatus.ACTIVE, List.of(UserRole.ADMIN))));
        when(tenantIdProvider.getTenantId()).thenReturn(null);

        assertNull(resolver.resolve(USER_ID).getTenantId());
    }

    @Test
    void ownerRoleImpliesAdmin() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(UserStatus.ACTIVE, List.of(UserRole.OWNER))));
        when(tenantIdProvider.getTenantId()).thenReturn(POD_TENANT);

        AuthPrincipal principal = resolver.resolve(USER_ID);

        assertEquals(List.of("OWNER", "ADMIN"), principal.getRoles());
        assertEquals(ActorType.ADMIN, principal.getActorType());
    }

    @Test
    void grantedRolesKeepTheirOrderAndAreNotDuplicated() {
        when(userRepository.findById(USER_ID))
                .thenReturn(Optional.of(user(UserStatus.ACTIVE, List.of(UserRole.ADMIN, UserRole.OWNER, UserRole.ADMIN))));
        when(tenantIdProvider.getTenantId()).thenReturn(POD_TENANT);

        assertEquals(List.of("ADMIN", "OWNER"), resolver.resolve(USER_ID).getRoles());
    }

    @Test
    void ownerWithoutRolesGetsNoRoles() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(UserStatus.ACTIVE, List.of())));
        when(tenantIdProvider.getTenantId()).thenReturn(POD_TENANT);

        AuthPrincipal principal = resolver.resolve(USER_ID);

        assertTrue(principal.getRoles().isEmpty());
        assertEquals(ActorType.ADMIN, principal.getActorType());
    }

    @Test
    void nullRolesAreTreatedAsNoRoles() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(UserStatus.ACTIVE, null)));
        when(tenantIdProvider.getTenantId()).thenReturn(POD_TENANT);

        assertTrue(resolver.resolve(USER_ID).getRoles().isEmpty());
    }

    private static User user(UserStatus status, List<UserRole> roles) {
        User user = new User();
        user.setId(USER_ID);
        user.setEmail("jane@example.com");
        user.setFirstName("Jane");
        user.setLastName("Doe");
        user.setStatus(status);
        user.setRoles(roles);
        return user;
    }
}
