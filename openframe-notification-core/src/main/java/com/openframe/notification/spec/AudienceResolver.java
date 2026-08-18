package com.openframe.notification.spec;

import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class AudienceResolver {

    private static final List<UserRole> ADMIN_ROLES = List.of(UserRole.ADMIN, UserRole.OWNER);

    private final UserRepository userRepository;

    public Set<String> resolveActiveAdmins() {
        Set<String> audience = new LinkedHashSet<>();
        for (User user : userRepository.findByRolesInAndStatus(ADMIN_ROLES, UserStatus.ACTIVE)) {
            String id = user.getId();
            if (id != null) {
                audience.add(id);
            }
        }
        return audience;
    }
}
