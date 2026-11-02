package com.openframe.notification.spec;

import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AudienceResolverTest {

    private UserRepository userRepository;
    private AudienceResolver resolver;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        resolver = new AudienceResolver(userRepository);
    }

    @Test
    @DisplayName("An explicit declaration resolves without touching the user store")
    void explicit_ids_pass_through() {
        Audience declared = Audience.users("u-1").andMachines("m-1");

        Recipients recipients = resolver.resolve(declared);

        assertThat(recipients.getUsers()).containsExactly("u-1");
        assertThat(recipients.getMachines()).containsExactly("m-1");
        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("The allActiveAdmins marker materializes to the current active admins")
    void marker_resolves_to_active_admins() {
        stubActiveAdmins("admin-1", "admin-2");

        Recipients recipients = resolver.resolve(Audience.allActiveAdmins());

        assertThat(recipients.getUsers()).containsExactlyInAnyOrder("admin-1", "admin-2");
    }

    @Test
    @DisplayName("allActive(OWNER) asks the user store for OWNER only — an admin is never an owner by proxy")
    void owner_marker_resolves_to_active_owners_only() {
        List<UserRole> ownerRole = List.of(UserRole.OWNER);
        List<User> owners = List.of(user("owner-1"));
        when(userRepository.findByRolesInAndStatus(ownerRole, UserStatus.ACTIVE)).thenReturn(owners);

        Recipients recipients = resolver.resolve(Audience.allActive(UserRole.OWNER).except("owner-2"));

        assertThat(recipients.getUsers()).containsExactly("owner-1");
        verify(userRepository).findByRolesInAndStatus(ownerRole, UserStatus.ACTIVE);
    }

    @Test
    @DisplayName("allActiveAdmins is effective ADMIN: the store is asked for ADMIN and OWNER, as before")
    void admins_marker_asks_for_admins_and_owners() {
        stubActiveAdmins("admin-1");

        resolver.resolve(Audience.allActiveAdmins());

        verify(userRepository).findByRolesInAndStatus(List.of(UserRole.ADMIN, UserRole.OWNER), UserStatus.ACTIVE);
    }

    /** A role added to UserRole without a resolvable audience fails here, not in production. */
    @ParameterizedTest
    @EnumSource(UserRole.class)
    @DisplayName("Every UserRole resolves through allActive(role)")
    void every_role_has_an_audience(UserRole role) {
        List<UserRole> granted = List.copyOf(UserRole.grantedFor(Set.of(role)));
        List<User> holders = List.of(user("u-" + role));
        when(userRepository.findByRolesInAndStatus(granted, UserStatus.ACTIVE)).thenReturn(holders);

        Recipients recipients = resolver.resolve(Audience.allActive(role));

        assertThat(granted).contains(role);
        assertThat(recipients.getUsers()).containsExactly("u-" + role);
    }

    @Test
    @DisplayName("except() cuts both the explicit ids and the resolved admins — the actor never notifies themself")
    void exclusions_apply_to_resolved_admins() {
        stubActiveAdmins("admin-1", "actor");
        Audience declared = Audience.allActiveAdmins().andUsers(List.of("u-1")).except("actor").except("u-1");

        Recipients recipients = resolver.resolve(declared);

        assertThat(recipients.getUsers()).containsExactly("admin-1");
    }

    @Test
    @DisplayName("A declaration that resolves to nobody yields empty recipients — the pipeline skips")
    void empty_resolution() {
        stubActiveAdmins("actor");

        Recipients recipients = resolver.resolve(Audience.allActiveAdmins().except("actor"));

        assertThat(recipients.isEmpty()).isTrue();
    }

    private void stubActiveAdmins(String... ids) {
        List<User> admins = java.util.Arrays.stream(ids).map(AudienceResolverTest::user).toList();
        when(userRepository.findByRolesInAndStatus(anyList(), any())).thenReturn(admins);
    }

    private static User user(String id) {
        User user = mock(User.class);
        when(user.getId()).thenReturn(id);
        return user;
    }
}
