package com.openframe.data.repository.user.publishing;

import com.openframe.data.document.user.User;
import com.openframe.publishing.api.model.TenantScopedId;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

// The full name of each user of a reconcile batch, by tenant and id, for every projection that copies it.
public final class UserFullNames {

    private UserFullNames() {
    }

    public static Map<TenantScopedId, String> buildByTenantAndId(List<User> users) {
        Map<TenantScopedId, String> names = new HashMap<>();
        for (User user : users) {
            String tenantId = user.getTenantId();
            String userId = user.getId();
            String firstName = user.getFirstName();
            String lastName = user.getLastName();
            TenantScopedId key = new TenantScopedId(tenantId, userId);
            String fullName = UserEvent.fullName(firstName, lastName);
            names.put(key, fullName);
        }
        return names;
    }
}
