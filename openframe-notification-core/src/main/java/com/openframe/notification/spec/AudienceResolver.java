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

    public Recipients resolve(Audience declared) {
        Set<String> users = new LinkedHashSet<>(declared.userIds);
        if (declared.allActiveAdmins) {
            Set<String> admins = resolveActiveAdmins();
            users.addAll(admins);
        }
        users.removeAll(declared.excludedUserIds);
        return Recipients.of(users, declared.machineIds);
    }

    private Set<String> resolveActiveAdmins() {
        Set<String> admins = new LinkedHashSet<>();
        for (User user : userRepository.findByRolesInAndStatus(ADMIN_ROLES, UserStatus.ACTIVE)) {
            String id = user.getId();
            if (id != null) {
                admins.add(id);
            }
        }
        return admins;
    }
}
