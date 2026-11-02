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

    private final UserRepository userRepository;

    public Recipients resolve(Audience declared) {
        Set<String> users = new LinkedHashSet<>(declared.userIds);
        if (!declared.activeRoles.isEmpty()) {
            Set<UserRole> granted = UserRole.grantedFor(declared.activeRoles);
            // A List, not the EnumSet: the callers' tests stub the repository with anyList().
            List<UserRole> grantedList = List.copyOf(granted);
            Set<String> byRole = resolveActive(grantedList);
            users.addAll(byRole);
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
