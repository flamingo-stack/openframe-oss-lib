package com.openframe.api.service.user;

import com.openframe.api.dto.user.UpdateUserRequest;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.dto.user.UserPageResponse;
import com.openframe.api.exception.OperationNotAllowedException;
import com.openframe.api.exception.UserSelfDeleteNotAllowedException;
import com.openframe.api.mapper.UserMapper;
import com.openframe.api.service.processor.UserProcessor;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Optional;

import static com.openframe.data.document.user.UserRole.OWNER;
import static com.openframe.data.document.user.UserStatus.DELETED;

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
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        return userMapper.toResponse(user);
    }

    public UserResponse updateUser(String id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));

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
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));

        if (requesterUserId.equals(user.getId())) {
            throw new UserSelfDeleteNotAllowedException("User cannot delete self");
        }

        if (user.getRoles().contains(OWNER)) {
            throw new OperationNotAllowedException("Owner accounts can’t be deleted");
        }

        if (user.getStatus() != DELETED) {
            user.setStatus(DELETED);
            User savedUser = userRepository.save(user);

            userProcessor.postProcessUserDeleted(savedUser);
        }
    }
}


