package com.openframe.api.service.user;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.user.UpdateUserRequest;
import com.openframe.api.dto.user.UserFilterInput;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.dto.user.UserPageResponse;
import com.openframe.api.exception.OperationNotAllowedException;
import com.openframe.api.exception.OwnerDeleteNotAllowedException;
import com.openframe.api.exception.UserNotFoundException;
import com.openframe.api.mapper.UserMapper;
import com.openframe.api.service.processor.UserProcessor;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.auth.SsoIdentityRepository;
import com.openframe.data.repository.user.UserPageCursor;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.notification.mail.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import static com.openframe.data.document.user.UserRole.ADMIN;
import static com.openframe.data.document.user.UserRole.OWNER;
import static com.openframe.data.document.user.UserStatus.ACTIVE;
import static com.openframe.data.document.user.UserStatus.DELETED;
import static com.openframe.data.document.user.UserStatus.SELF_DELETED;

@Service
@Slf4j
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final SsoIdentityRepository ssoIdentityRepository;
    private final UserMapper userMapper;
    private final UserProcessor userProcessor;
    private final EmailService emailService;

    public Optional<User> getUserByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public boolean existsActiveUserByEmail(String email) {
        return userRepository.existsByEmailAndStatus(email, UserStatus.ACTIVE);
    }

    /** Upper bound for a REST page; lower it once no client asks for the whole tenant in one page. */
    static final int MAX_REST_PAGE_SIZE = 1000;

    /** The order of the GraphQL connection, so a REST page and a GraphQL page agree. */
    static final Sort USER_ORDER = Sort.by(Sort.Order.asc("email"), Sort.Order.asc("_id"));

    public UserPageResponse listUsers(int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_REST_PAGE_SIZE), USER_ORDER);
        Page<User> p = userRepository.findAll(pageable);
        UserPageResponse response = UserPageResponse.builder()
                .items(p.getContent().stream().map(userMapper::toResponse).toList())
                .page(p.getNumber())
                .size(p.getSize())
                .totalElements(p.getTotalElements())
                .totalPages(p.getTotalPages())
                .hasNext(p.hasNext())
                .build();
        userProcessor.postProcessUserGet(response);
        return response;
    }

    public CountedGenericQueryResult<UserResponse> queryUsers(UserFilterInput filter, String search,
                                                             CursorPaginationCriteria pagination) {
        CursorPaginationCriteria page = pagination.normalize();
        List<UserStatus> statuses = filter != null ? filter.getStatuses() : null;
        long filteredCount = userRepository.countUsers(statuses, search);
        List<User> raw = userRepository.findUsersPage(statuses, search, page.getCursor(), page.getLimit() + 1);
        boolean hasNextPage = raw.size() > page.getLimit();
        List<UserResponse> items = toResponses(hasNextPage ? raw.subList(0, page.getLimit()) : raw);
        return CountedGenericQueryResult.<UserResponse>builder()
                .items(items)
                .pageInfo(PageInfo.builder()
                        .hasNextPage(hasNextPage)
                        .hasPreviousPage(page.hasCursor())
                        .startCursor(items.isEmpty() ? null : cursorOf(items.getFirst()))
                        .endCursor(items.isEmpty() ? null : cursorOf(items.getLast()))
                        .build())
                .filteredCount((int) filteredCount)
                .build();
    }

    public Optional<UserResponse> findUserById(String id) {
        return userRepository.findById(id).map(user -> toResponses(List.of(user)).getFirst());
    }

    private static String cursorOf(UserResponse user) {
        return CursorCodec.encode(UserPageCursor.of(user.getEmail(), user.getId()));
    }

    public UserResponse getUserById(String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
        UserResponse response = userMapper.toResponse(user);
        userProcessor.postProcessUserGet(response);
        return response;
    }

    public List<UserResponse> getUsersByIds(Collection<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return toResponses(userRepository.findAllById(ids));
    }

    /** Maps through the {@link UserProcessor}, which adds the avatar in SaaS. */
    private List<UserResponse> toResponses(List<User> users) {
        UserPageResponse pageResponse = UserPageResponse.builder()
                .items(users.stream().map(userMapper::toResponse).toList())
                .build();
        userProcessor.postProcessUserGet(pageResponse);
        return pageResponse.getItems();
    }

    public UserResponse updateUser(String id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));

        if (request.getFirstName() != null) {
            user.setFirstName(request.getFirstName());
        }
        if (request.getLastName() != null) {
            user.setLastName(request.getLastName());
        }

        User savedUser = userRepository.save(user);
        userProcessor.postProcessUserUpdated(savedUser);
        return toResponses(List.of(savedUser)).getFirst();
    }

    public void softDeleteUser(String id, String requesterUserId) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));

        if (user.getRoles().contains(OWNER)) {
            throw new OwnerDeleteNotAllowedException("Owner accounts can’t be deleted; transfer ownership first");
        }

        if (user.getStatus() != ACTIVE) {
            return;
        }

        // Self-deletion anonymizes the email, so capture the real address for the notification
        String originalEmail = user.getEmail();

        if (requesterUserId.equals(user.getId())) {
            user.setStatus(SELF_DELETED);
            anonymize(user);
        } else {
            user.setStatus(DELETED);
        }
        User savedUser = userRepository.save(user);

        // A deleted user's federated identity links must not keep resolving future SSO logins
        // to this account. Best-effort — the deletion itself is already committed.
        try {
            ssoIdentityRepository.deleteByUserId(savedUser.getId());
        } catch (Exception e) {
            log.warn("Failed to remove sso identity links for deleted user {}: {}", savedUser.getId(), e.getMessage());
        }

        userProcessor.postProcessUserDeleted(savedUser);

        // Notification failure must not fail the already-completed deletion
        try {
            emailService.sendAccountDeletedEmail(originalEmail);
        } catch (Exception e) {
            log.error("Failed to send account deletion email to {}", originalEmail, e);
        }
    }

    /**
     * Transfer the OWNER role from the requester to another active user in the tenant.
     * Only the current owner can transfer ownership. The new owner is granted first and the
     * requester demoted after, so a failure in between leaves two owners (recoverable by a
     * second transfer) rather than none.
     */
    public void transferOwnership(String newOwnerId, String requesterUserId) {
        User requester = userRepository.findById(requesterUserId)
                .orElseThrow(() -> new UserNotFoundException(requesterUserId));

        if (!requester.getRoles().contains(OWNER)) {
            throw new OperationNotAllowedException("Only the owner can transfer ownership");
        }
        if (newOwnerId.equals(requesterUserId)) {
            return;
        }

        User newOwner = userRepository.findById(newOwnerId)
                .orElseThrow(() -> new UserNotFoundException(newOwnerId));
        if (newOwner.getStatus() != ACTIVE) {
            throw new OperationNotAllowedException("Ownership can only be transferred to an active user");
        }

        newOwner.setRoles(new ArrayList<>(List.of(OWNER)));
        User savedNewOwner = userRepository.save(newOwner);
        userProcessor.postProcessUserUpdated(savedNewOwner);

        requester.setRoles(new ArrayList<>(List.of(ADMIN)));
        User savedRequester = userRepository.save(requester);
        userProcessor.postProcessUserUpdated(savedRequester);

        // Notification failure must not fail the already-completed transfer
        try {
            emailService.sendOwnershipTransferEmail(savedNewOwner.getEmail());
        } catch (Exception e) {
            log.error("Failed to send ownership transfer email to {}", savedNewOwner.getEmail(), e);
        }
    }

    /**
     * Erase personal data on self-deletion. The email tombstone must stay unique per user
     * because of the unique {tenantId, email} index on the users collection, and freeing the
     * real email lets the person register a fresh account later instead of reactivating this
     * one. The document is an AuthUser at runtime (polymorphic {@code _class} mapping), so
     * credential fields are cleared too.
     */
    private void anonymize(User user) {
        user.setEmail("deleted-" + user.getId() + "@deleted.invalid");
        user.setFirstName("Deleted");
        user.setLastName("Account");
        if (user instanceof AuthUser authUser) {
            authUser.setPasswordHash(null);
            authUser.setExternalUserId(null);
            authUser.setImageUrl(null);
        }
    }
}


