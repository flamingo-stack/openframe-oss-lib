package com.openframe.api.service.user;

import com.openframe.api.dto.user.UpdateUserRequest;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.dto.user.UserPageResponse;
import com.openframe.api.exception.OperationNotAllowedException;
import com.openframe.api.exception.UserNotFoundException;
import com.openframe.api.mapper.UserMapper;
import com.openframe.api.service.processor.UserProcessor;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final UserProcessor userProcessor;

    public Optional<User> getUserByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public boolean existsActiveUserByEmail(String email) {
        return userRepository.existsByEmailAndStatus(email, UserStatus.ACTIVE);
    }

    public UserPageResponse listUsers(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
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
        List<User> users = userRepository.findAllById(ids);
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
        return userMapper.toResponse(savedUser);
    }

    public void softDeleteUser(String id, String requesterUserId) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));

        if (user.getRoles().contains(OWNER)) {
            throw new OperationNotAllowedException("Owner accounts can’t be deleted");
        }

        if (user.getStatus() != ACTIVE) {
            return;
        }

        if (requesterUserId.equals(user.getId())) {
            user.setStatus(SELF_DELETED);
            anonymize(user);
        } else {
            user.setStatus(DELETED);
        }
        User savedUser = userRepository.save(user);

        userProcessor.postProcessUserDeleted(savedUser);
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


