package com.openframe.api.service.user;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.invitation.InvitationFilterInput;
import com.openframe.api.dto.invitation.InvitationFilters;
import com.openframe.api.dto.invitation.InvitationResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.user.FilterOption;
import com.openframe.api.dto.user.UpdateUserRequest;
import com.openframe.api.dto.user.UserFilterInput;
import com.openframe.api.dto.user.UserFilters;
import com.openframe.api.dto.user.UserPageResponse;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.exception.OperationNotAllowedException;
import com.openframe.api.mapper.InvitationMapper;
import com.openframe.api.mapper.UserMapper;
import com.openframe.api.service.processor.InvitationProcessor;
import com.openframe.api.service.processor.UserProcessor;
import com.openframe.core.email.EmailDomainPolicy;
import com.openframe.data.document.user.Invitation;
import com.openframe.data.document.user.InvitationStatus;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.auth.SsoIdentityRepository;
import com.openframe.data.repository.user.InvitationListFilter;
import com.openframe.data.repository.user.InvitationRepository;
import com.openframe.data.repository.user.UserListFilter;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.notification.mail.service.EmailService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static com.openframe.api.dto.invitation.InvitationStatus.EXPIRED;
import static com.openframe.api.dto.invitation.InvitationStatus.PENDING;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserListingTest {

    @Mock private UserRepository userRepository;
    @Mock private SsoIdentityRepository ssoIdentityRepository;
    @Mock private UserProcessor userProcessor;
    @Mock private EmailService emailService;
    @Mock private InvitationRepository invitationRepository;
    @Mock private InvitationProcessor invitationProcessor;
    @Mock private EmailDomainPolicy emailDomainPolicy;

    private UserService userService() {
        return new UserService(userRepository, ssoIdentityRepository, new UserMapper(), userProcessor, emailService);
    }

    private InvitationService invitationService() {
        return new InvitationService(invitationRepository, new InvitationMapper(), emailService, userService(),
                invitationProcessor, emailDomainPolicy);
    }

    @Test
    @DisplayName("users: one extra row decides hasNextPage, cursors follow (email, id), the count is the filtered total")
    void usersPage() {
        List<UserStatus> statuses = List.of(UserStatus.ACTIVE);
        UserListFilter listFilter = new UserListFilter(statuses, Set.of(), List.of("u0"), "jane");
        when(userRepository.countUsers(listFilter)).thenReturn(7L);
        when(userRepository.findUsersPage(listFilter, "a@acme.io_u0", 3))
                .thenReturn(List.of(user("u1", "b@acme.io"), user("u2", "c@acme.io"), user("u3", "d@acme.io")));

        CountedGenericQueryResult<UserResponse> page = userService().queryUsers(
                UserFilterInput.builder().statuses(statuses).excludeIds(List.of("u0")).build(), "jane",
                CursorPaginationCriteria.builder().limit(2).cursor("a@acme.io_u0").build());

        assertThat(page.getItems()).extracting(UserResponse::getId).containsExactly("u1", "u2");
        assertThat(page.getFilteredCount()).isEqualTo(7);
        assertThat(page.getPageInfo().isHasNextPage()).isTrue();
        assertThat(page.getPageInfo().isHasPreviousPage()).isTrue();
        assertThat(page.getPageInfo().getStartCursor()).isEqualTo(CursorCodec.encode("b@acme.io_u1"));
        assertThat(page.getPageInfo().getEndCursor()).isEqualTo(CursorCodec.encode("c@acme.io_u2"));
        // The avatars come from the processor, as on every other user read.
        verify(userProcessor).postProcessUserGet(any(UserPageResponse.class));
    }

    @Test
    @DisplayName("users: the last page has no next page and an empty page has no cursors")
    void usersLastAndEmptyPage() {
        UserListFilter unfiltered = new UserListFilter(null, null, null, null);
        when(userRepository.countUsers(unfiltered)).thenReturn(1L, 0L);
        when(userRepository.findUsersPage(unfiltered, null, 21))
                .thenReturn(List.of(user("u1", "b@acme.io")), List.of());

        CountedGenericQueryResult<UserResponse> last =
                userService().queryUsers(null, null, CursorPaginationCriteria.builder().build());
        CountedGenericQueryResult<UserResponse> empty =
                userService().queryUsers(null, null, CursorPaginationCriteria.builder().build());

        assertThat(last.getPageInfo().isHasNextPage()).isFalse();
        assertThat(last.getPageInfo().isHasPreviousPage()).isFalse();
        assertThat(empty.getItems()).isEmpty();
        assertThat(empty.getPageInfo().getEndCursor()).isNull();
    }

    @Test
    @DisplayName("users: a role filter asks for the granted roles, so ADMIN finds the owners too")
    void usersRoleFilterMatchesEffectiveRoles() {
        when(userRepository.findUsersPage(any(), any(), anyInt())).thenReturn(List.of());

        for (List<UserRole> roles : List.of(List.of(UserRole.ADMIN), List.of(UserRole.OWNER), List.<UserRole>of())) {
            userService().queryUsers(UserFilterInput.builder().roles(roles).build(), null,
                    CursorPaginationCriteria.builder().build());
        }

        ArgumentCaptor<UserListFilter> filters = ArgumentCaptor.forClass(UserListFilter.class);
        verify(userRepository, times(3)).findUsersPage(filters.capture(), any(), anyInt());
        assertThat(filters.getAllValues()).extracting(UserListFilter::roles).containsExactly(
                Set.of(UserRole.ADMIN, UserRole.OWNER), Set.of(UserRole.OWNER), Set.of());
    }

    @Test
    @DisplayName("userFilters: a funnel is counted without its own ticks but with the other's; ADMIN counts the owners")
    void userFiltersCountEachFunnelWithoutItsOwnTicks() {
        Set<UserRole> admins = Set.of(UserRole.ADMIN, UserRole.OWNER);
        List<String> excluded = List.of("u-1");
        when(userRepository.countUsers(new UserListFilter(List.of(UserStatus.ACTIVE), admins, excluded, "smith")))
                .thenReturn(5L);
        when(userRepository.countUsers(new UserListFilter(List.of(UserStatus.DELETED), admins, excluded, "smith")))
                .thenReturn(2L);
        when(userRepository.countUsers(
                new UserListFilter(List.of(UserStatus.SELF_DELETED), admins, excluded, "smith"))).thenReturn(0L);
        when(userRepository.countUsers(
                new UserListFilter(List.of(UserStatus.DELETED), Set.of(UserRole.OWNER), excluded, "smith")))
                .thenReturn(1L);

        UserFilters filters = userService().userFilters(UserFilterInput.builder()
                .statuses(List.of(UserStatus.DELETED))
                .roles(List.of(UserRole.ADMIN))
                .excludeIds(excluded)
                .build(), "smith");

        assertThat(filters.statuses()).containsExactly(
                new FilterOption<>(UserStatus.ACTIVE, 5),
                new FilterOption<>(UserStatus.DELETED, 2),
                new FilterOption<>(UserStatus.SELF_DELETED, 0));
        assertThat(filters.roles()).containsExactly(
                new FilterOption<>(UserRole.ADMIN, 2),
                new FilterOption<>(UserRole.OWNER, 1));
    }

    @Test
    @DisplayName("REST users page: size is clamped to 1..1000, page to >= 0, and the order is stable")
    void restUsersPageIsClampedAndOrdered() {
        when(userRepository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

        userService().listUsers(-1, 5000);

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(userRepository).findAll(captor.capture());
        assertThat(captor.getValue().getPageNumber()).isZero();
        assertThat(captor.getValue().getPageSize()).isEqualTo(1000);
        assertThat(captor.getValue().getSort()).isEqualTo(Sort.by(Sort.Order.asc("email"), Sort.Order.asc("_id")));
    }

    @Test
    @DisplayName("invitations: PENDING and EXPIRED narrow by expiry, both or none keep every open invitation")
    void invitationStatusFilter() {
        when(invitationRepository.countOpenInvitations(any(), any())).thenReturn(0L);
        when(invitationRepository.findOpenInvitationsPage(any(), any(), any(), anyInt())).thenReturn(List.of());

        for (InvitationFilterInput filter : Arrays.asList(
                filter(EXPIRED), filter(PENDING), filter(PENDING, EXPIRED), filter(), null)) {
            invitationService().queryInvitations(filter, null, CursorPaginationCriteria.builder().build());
        }

        ArgumentCaptor<InvitationListFilter> filters = ArgumentCaptor.forClass(InvitationListFilter.class);
        verify(invitationRepository, times(5)).findOpenInvitationsPage(filters.capture(), any(), any(), eq(21));
        assertThat(filters.getAllValues()).extracting(InvitationListFilter::expired)
                .containsExactly(true, false, null, null, null);
    }

    @Test
    @DisplayName("invitations: a role filter asks for the granted roles")
    void invitationRoleFilter() {
        when(invitationRepository.findOpenInvitationsPage(any(), any(), any(), anyInt())).thenReturn(List.of());

        invitationService().queryInvitations(InvitationFilterInput.builder().roles(List.of(UserRole.ADMIN)).build(),
                null, CursorPaginationCriteria.builder().build());

        ArgumentCaptor<InvitationListFilter> filter = ArgumentCaptor.forClass(InvitationListFilter.class);
        verify(invitationRepository).findOpenInvitationsPage(filter.capture(), any(), any(), anyInt());
        assertThat(filter.getValue().roles()).isEqualTo(Set.of(UserRole.ADMIN, UserRole.OWNER));
    }

    @Test
    @DisplayName("invitationFilters: a funnel is counted without its own ticks but with the other's")
    void invitationFiltersCountEachFunnelWithoutItsOwnTicks() {
        Set<UserRole> admins = Set.of(UserRole.ADMIN, UserRole.OWNER);
        when(invitationRepository.countOpenInvitations(eq(new InvitationListFilter(false, admins, "acme")), any()))
                .thenReturn(3L);
        when(invitationRepository.countOpenInvitations(eq(new InvitationListFilter(true, admins, "acme")), any()))
                .thenReturn(4L);
        when(invitationRepository.countOpenInvitations(
                eq(new InvitationListFilter(true, Set.of(UserRole.OWNER), "acme")), any())).thenReturn(0L);

        InvitationFilters filters = invitationService().invitationFilters(InvitationFilterInput.builder()
                .statuses(List.of(EXPIRED))
                .roles(List.of(UserRole.ADMIN))
                .build(), "acme");

        assertThat(filters.statuses()).containsExactly(new FilterOption<>(PENDING, 3), new FilterOption<>(EXPIRED, 4));
        assertThat(filters.roles()).containsExactly(
                new FilterOption<>(UserRole.ADMIN, 4),
                new FilterOption<>(UserRole.OWNER, 0));
    }

    @Test
    @DisplayName("invitations: one extra row decides hasNextPage, the status is computed, cursors follow (createdAt, id)")
    void invitationsPage() {
        Instant createdAt = Instant.ofEpochMilli(1_750_000_000_000L);
        InvitationListFilter acme = new InvitationListFilter(null, null, "acme");
        when(invitationRepository.countOpenInvitations(eq(acme), any())).thenReturn(2L);
        when(invitationRepository.findOpenInvitationsPage(eq(acme), any(), any(), eq(2)))
                .thenReturn(List.of(invitation("inv-2", createdAt), invitation("inv-1", createdAt.minusSeconds(60))));

        CountedGenericQueryResult<InvitationResponse> page = invitationService().queryInvitations(
                null, "acme", CursorPaginationCriteria.builder().limit(1).build());

        assertThat(page.getItems()).extracting(InvitationResponse::getId).containsExactly("inv-2");
        assertThat(page.getItems().getFirst().getStatus()).isEqualTo(EXPIRED);
        assertThat(page.getPageInfo().isHasNextPage()).isTrue();
        assertThat(page.getPageInfo().getEndCursor()).isEqualTo(CursorCodec.encode(createdAt.toEpochMilli() + "_inv-2"));
        assertThat(page.getFilteredCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("invitation node: accepted and revoked invitations are not exposed")
    void onlyOpenInvitationsResolve() {
        Invitation revoked = invitation("inv-1", Instant.now());
        revoked.setStatus(InvitationStatus.REVOKED);
        when(invitationRepository.findById("inv-1")).thenReturn(Optional.of(revoked));
        when(invitationRepository.findById("inv-2")).thenReturn(Optional.of(invitation("inv-2", Instant.now())));

        assertThat(invitationService().findOpenInvitation("inv-1")).isEmpty();
        assertThat(invitationService().findOpenInvitation("inv-2")).isPresent();
    }

    @Test
    @DisplayName("updateUser: a deleted account is not renamed, so a self-deleted one stays anonymized")
    void updateRefusesDeletedUsers() {
        User gone = user("u-1", "deleted-u-1@openframe.invalid");
        gone.setStatus(UserStatus.SELF_DELETED);
        when(userRepository.findById("u-1")).thenReturn(Optional.of(gone));
        UpdateUserRequest request = new UpdateUserRequest();
        request.setFirstName("Jane");

        assertThatThrownBy(() -> userService().updateUser("u-1", request))
                .isInstanceOf(OperationNotAllowedException.class);
        verify(userRepository, never()).save(any());
    }

    private static InvitationFilterInput filter(com.openframe.api.dto.invitation.InvitationStatus... statuses) {
        return InvitationFilterInput.builder().statuses(List.of(statuses)).build();
    }

    private static User user(String id, String email) {
        return User.builder().id(id).email(email).status(UserStatus.ACTIVE).roles(List.of(UserRole.ADMIN)).build();
    }

    private static Invitation invitation(String id, Instant createdAt) {
        return Invitation.builder()
                .id(id)
                .email(id + "@acme.io")
                .roles(List.of(UserRole.ADMIN))
                .createdAt(createdAt)
                .expiresAt(createdAt.plusSeconds(1))
                .status(InvitationStatus.PENDING)
                .build();
    }
}
