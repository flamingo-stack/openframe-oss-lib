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
    private static final List<UserRole> OWNER_ROLES = List.of(UserRole.OWNER);

    private final UserRepository userRepository;

    public Recipients resolve(Audience declared) {
        Set<String> users = new LinkedHashSet<>(declared.userIds);
        if (declared.allActiveAdmins) {
            Set<String> admins = resolveActive(ADMIN_ROLES);
            users.addAll(admins);
        }
        if (declared.allActiveOwners) {
            Set<String> owners = resolveActive(OWNER_ROLES);
            users.addAll(owners);
        }
        users.removeAll(declared.excludedUserIds);
        return Recipients.of(users, declared.machineIds);
    }

    private Set<String> resolveActive(List<UserRole> roles) {
        Set<String> ids = new LinkedHashSet<>();
        for (User user : userRepository.findByRolesInAndStatus(roles, UserStatus.ACTIVE)) {
            String id = user.getId();
            if (id != null) {
                ids.add(id);
            }
        }
        return ids;
    }
}
